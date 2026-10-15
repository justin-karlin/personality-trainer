// recommendLevel (src/lib/program.ts) as a Handwired program.
//
//   npx tsx lab/handwired/recommend-level.ts       prints the program's size, a few evaluations and timings
//   npx vitest run lab/handwired/recommend-level   compares it with the real recommendLevel (recommend-level.test.ts)
//
// Split of work
// - Host (plain JS, weekToInputs): the reads recommendLevel does before it decides. Filter last week's commitments to
//   the trait, round their mean level (Math.round, then clamp to 1..3), take the capped completion rate with the app's
//   own completionRate (float64), and the mean enjoyment rating. These are written into five source cells.
// - Program (Handwired, buildRecommendLevelProgram): every decision. Three threshold comparisons, one level comparison,
//   and integer ReLU arithmetic that picks 1, 2 or 3.
//
// FP32 and the thresholds (why every case is exact, deliberately)
// The source table is a Float32Array, so the host's float64 rate x = done/target is rounded once, to f(x), when written.
// The program compares f(x) with f(T) for T = 0.5, 0.8 and 2 (Handwired's emitCompare is exact on FP32 values):
// - f is monotone and f(T) is what f does to the threshold itself, so x >= T  =>  f(x) >= f(T), and x = T exactly (4/5,
//   8/10, 1/2, a mean of exactly 2) lands on f(T) and compares the same way as in JS. 0.5 and 2 are FP32 values;
//   f(0.8) = 0.800000011920929 is not 0.8, but it is the image of the JS literal 0.8, which is all that matters here.
// - The only inputs that could flip are x on the other side of T but within half an FP32 step of it (2^-25 near 0.8,
//   2^-26 below 0.5, 2^-23 above 2), where f(x) rounds onto f(T). A rate k/n != T is at least 1/(5n) from 0.8 and
//   1/(2n) from 0.5, and a mean of integer ratings s/m != 2 is at least 1/m from 2, so no rate with a target total
//   below 6.7 million and no mean of fewer than 8 million ratings can be in that band. The test sweeps every target
//   total up to 100,000 at the k next to each threshold and finds no flip.
// - What we deliberately do NOT do: compute the rate inside the program in FP32. done * f(1/target) gives
//   f(20 * f(1/25)) = 0.79999995 < f(0.8), so 20 of 25 would not step up while JS's 20/25 >= 0.8 does (the test checks
//   this hazard exists). Rounding the float64 quotient once avoids it. Another exact option would be integer cells for
//   done and target and comparing 5*done >= 4*target, but the planner's own input is the rate.
// - Handwired's emitCompare comment says to pick "the smallest FP32 value at or above" a non-FP32 threshold. That
//   rule is for inputs that are already FP32 values. Ours are rounded float64 quotients, for which f(T) is the right
//   constant; for T = 0.8 the two coincide anyway (f(0.8) > 0.8).
import {pathToFileURL} from 'node:url'
import {emitCompare, type Wire} from './vendor/numeric-ui-core.ts'
import {createEvaluator, createSourceTable, input, inputBit} from './vendor/cells.ts'
import {completionRate} from '../../src/lib/program.ts'
import type {Challenge, ChallengeLevel, TraitId, WeekPlan} from '../../src/types.ts'

/** The rule's constants, as written in src/lib/program.ts recommendLevel. */
export const RULE = {stepDownBelow: 0.5, stepUpAtLeast: 0.8, dislikedAtMost: 2} as const

/** The program's inputs: what recommendLevel reads from last week, as numbers. */
export type LevelInputs = {
  /** 1 when there is a previous week with at least one commitment for this trait, else 0 (the rule returns 1). */
  has: 0 | 1
  /** clampLevel(Math.round(mean level of those commitments)), 1..3. Ignored when has = 0. */
  avgLevel: ChallengeLevel
  /** completionRate of those commitments, 0..1 (done capped at target per commitment, over the summed targets). */
  rate: number
  /** 1 when at least one of them has an enjoyment rating. */
  hasRatings: 0 | 1
  /** Mean enjoyment rating (1..5) when hasRatings = 1, else 0. */
  meanEnjoyment: number
}

/** Source-table declarations (cells.ts). Every comparison reads finite ranges; avgLevel is on the integer grid. */
export const levelCellSpec = {
  has: inputBit(),
  avgLevel: input([1, 3], {grid: 1, initial: 1}),
  rate: input([0, 1]),
  hasRatings: inputBit(),
  meanEnjoyment: input([0, 5]),
}

export function buildRecommendLevelProgram() {
  const table = createSourceTable()
  const cells = table.declare(levelCellSpec)
  const c = table.createCircuit()
  // Threshold constants: f(T), see the header. circuit.constant stores f(value) anyway; Math.fround makes it visible.
  const half = c.constant(Math.fround(RULE.stepDownBelow))
  const strong = c.constant(Math.fround(RULE.stepUpAtLeast))
  const dislikeCut = c.constant(Math.fround(RULE.dislikedAtMost))

  // Exact 0/1 bits. rate and meanEnjoyment have no grid, so these are sign cascades; avgLevel is on grid 1.
  const weak = emitCompare(c, cells.rate, '<', half) //                    rate < 0.5
  const strongRate = emitCompare(c, cells.rate, '>=', strong) //           rate >= 0.8
  const lowEnjoyment = emitCompare(c, cells.meanEnjoyment, '<=', dislikeCut) // mean <= 2
  const atLevel1 = emitCompare(c, cells.avgLevel, '<=', c.constant(1)) //  avgLevel === 1 (avgLevel is 1..3)
  // disliked = ratings.length > 0 && mean <= 2:  AND of two bits = relu(a + b - 1)
  const disliked = c.reglu([], 1, [[cells.hasRatings, 1], [lowEnjoyment, 1]], -1)
  // stepUp = has && !weak && strongRate && !disliked && avgLevel === 1. Every term is an exact bit, so the AND of the five
  // literals is relu(has + strongRate + atLevel1 - weak - disliked - 2): 1 only when all hold, else <= 0.
  const stepUp = c.reglu([], 1, [[cells.has, 1], [strongRate, 1], [atLevel1, 1], [weak, -1], [disliked, -1]], -2)
  // kept = has ? clampLevel(avgLevel - weak) - 1 : 0  =  relu(avgLevel - weak + 3·has - 4).
  // has = 1: relu(avgLevel - weak - 1), i.e. max(1, avgLevel - weak) - 1 (step down after a weak week, not below 1).
  // has = 0: avgLevel - weak - 4 <= -1, so 0.
  const kept = c.reglu([], 1, [[cells.avgLevel, 1], [weak, -1], [cells.has, 3]], -4)
  // When stepUp = 1 then avgLevel = 1 and weak = 0, so kept = 0 and the level is 2. Small integers: FP32-exact.
  const level = c.roundAffine([[kept, 1], [stepUp, 1]], 1)

  return {cells, output: {level, weak, strongRate, lowEnjoyment, disliked, stepUp}, ...table.finish()}
}

export type RecommendLevelProgram = ReturnType<typeof buildRecommendLevelProgram>

/** Writes inputs into a source table (Float32Array: values are rounded to FP32 here, once). */
export function writeInputs(program: RecommendLevelProgram, inputs: LevelInputs, source: Float32Array): Float32Array {
  const {cells} = program
  source[cells.has] = inputs.has
  source[cells.avgLevel] = inputs.avgLevel
  source[cells.rate] = inputs.rate
  source[cells.hasRatings] = inputs.hasRatings
  source[cells.meanEnjoyment] = inputs.meanEnjoyment
  return source
}

/** Host preprocessing: the reads recommendLevel(prev, trait, library) makes, as program inputs. No decisions here. */
export function weekToInputs(prev: WeekPlan | undefined, trait: TraitId, library: Challenge[]): LevelInputs {
  const none: LevelInputs = {has: 0, avgLevel: 1, rate: 0, hasRatings: 0, meanEnjoyment: 0}
  if (!prev) return none
  const forTrait = prev.commitments.filter((c) => library.find((x) => x.id === c.challengeId)?.trait === trait)
  if (!forTrait.length) return none
  const levels = forTrait.map((c) => library.find((x) => x.id === c.challengeId)!.level)
  const avgLevel = Math.min(3, Math.max(1, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length))) as ChallengeLevel
  const ratings = forTrait.map((c) => c.enjoyment).filter((e): e is number => e != null)
  return {
    has: 1,
    avgLevel,
    rate: completionRate({...prev, commitments: forTrait}),
    hasRatings: ratings.length ? 1 : 0,
    meanEnjoyment: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
  }
}

// One shared program and two evaluators, built on first use.
let shared: {
  program: RecommendLevelProgram
  source: Float32Array
  checked: ReturnType<typeof createEvaluator<RecommendLevelProgram['output']>>
  fast: (source: Float32Array) => Float32Array
} | undefined

function getShared() {
  if (!shared) {
    const program = buildRecommendLevelProgram()
    shared = {
      program,
      source: new Float32Array(program.initialSource),
      // cells.ts evaluator: checks ranges, bits and the avgLevel grid on every call, and that outputs are finite.
      checked: createEvaluator(program),
      // Compiled program for the level alone; checks source ranges only.
      fast: program.circuit.createTensorEvaluator([program.output.level]),
    }
  }
  return shared
}

/** Evaluates the program on inputs, validating every cell declaration. Returns 1, 2 or 3. */
export function evaluate(inputs: LevelInputs): ChallengeLevel {
  const s = getShared()
  return s.checked(writeInputs(s.program, inputs, s.source)).output.level as ChallengeLevel
}

/** Same result without the bit/grid validation (source ranges are still checked). For hot loops. */
export function evaluateFast(inputs: LevelInputs): ChallengeLevel {
  const s = getShared()
  return s.fast(writeInputs(s.program, inputs, s.source))[0] as ChallengeLevel
}

/**
 * Drop-in for recommendLevel(prev, trait, library): host preprocessing, then the program.
 * Domain (reviewer's note): exact for enjoyment ratings that are integers 1..5, as the Reflect UI writes them. A stored
 * rating outside 0..5 makes the evaluator throw (meanEnjoyment's declared range), and a non-integer mean within an FP32
 * half-step of 2 (e.g. a single rating of 2.0000001) can disagree with the JS rule. See the "domain" test.
 */
export function recommendLevelViaProgram(prev: WeekPlan | undefined, trait: TraitId, library: Challenge[]): ChallengeLevel {
  return evaluate(weekToInputs(prev, trait, library))
}

/** Operation and weight counts of the compiled program for the level output. */
export function programSize(program: RecommendLevelProgram = getShared().program) {
  const {circuit} = program
  const compiled = circuit.compileTensorProgram([program.output.level])
  let weights = 0
  let biases = 0
  for (const layer of compiled.layers) {
    weights += layer.weights.length
    biases += layer.outputSize
  }
  const roundingPoints: Record<string, number> = {}
  for (const {kind} of circuit.roundingPoints()) roundingPoints[kind] = (roundingPoints[kind] ?? 0) + 1
  return {
    sourceCells: circuit.sourceSize,
    builtOps: circuit.operations.length,
    liveOps: compiled.valueCount - compiled.sourceSize,
    layers: compiled.layers.length,
    weights, // nonzero coefficients in the compiled layers' sparse matrices
    biases, // one per live operation
    roundingPoints,
  }
}

function timePerCall(label: string, count: number, call: (i: number) => unknown) {
  for (let i = 0; i < 20_000; i++) call(i) // warm up
  const start = performance.now()
  let sink = 0
  for (let i = 0; i < count; i++) sink += call(i) as number
  const us = ((performance.now() - start) * 1000) / count
  console.log(`  ${label.padEnd(58)} ${us.toFixed(3)} us/call (${count} calls, checksum ${sink})`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {recommendLevel} = await import('../../src/lib/program.ts')
  const {CHALLENGES} = await import('../../src/data/challenges.ts')
  console.log('Program size:', programSize())
  const examples: LevelInputs[] = [
    {has: 0, avgLevel: 1, rate: 0, hasRatings: 0, meanEnjoyment: 0},
    {has: 1, avgLevel: 1, rate: 4 / 5, hasRatings: 0, meanEnjoyment: 0},
    {has: 1, avgLevel: 1, rate: 4 / 5, hasRatings: 1, meanEnjoyment: 2},
    {has: 1, avgLevel: 3, rate: 1 / 2, hasRatings: 1, meanEnjoyment: 4.5},
    {has: 1, avgLevel: 3, rate: 3 / 7, hasRatings: 0, meanEnjoyment: 0},
  ]
  for (const x of examples) console.log(' ', JSON.stringify(x), '->', evaluate(x))

  const inputsList: LevelInputs[] = []
  for (let i = 0; i < 1024; i++) {
    const n = 1 + (i % 14)
    inputsList.push({has: (i % 9 ? 1 : 0), avgLevel: (1 + (i % 3)) as ChallengeLevel, rate: (i % (n + 1)) / n, hasRatings: (i % 4 ? 1 : 0), meanEnjoyment: i % 4 ? 1 + (i % 17) / 4 : 0})
  }
  const week: WeekPlan = {
    weekIndex: 0, startDate: '2026-01-05',
    commitments: CHALLENGES.filter((c) => c.trait === 'C').slice(0, 3).map((c, i) => ({
      challengeId: c.id, ifThen: '', confidence: 7, target: 3 + i, completions: ['2026-01-05', '2026-01-06', '2026-01-07'].slice(0, 1 + i), enjoyment: i === 1 ? 2 : undefined,
    })),
  }
  const s = getShared()
  console.log(`Timing on Node ${process.version}:`)
  timePerCall('evaluate (cells.ts evaluator, validates inputs/outputs)', 1_000_000, (i) => evaluate(inputsList[i & 1023]!))
  timePerCall('evaluateFast (compiled tensor evaluator, range check only)', 1_000_000, (i) => evaluateFast(inputsList[i & 1023]!))
  timePerCall('circuit.evaluateReference (every wire, for tests)', 200_000, (i) => s.program.circuit.evaluateReference(writeInputs(s.program, inputsList[i & 1023]!, s.source))[s.program.output.level])
  timePerCall('recommendLevelViaProgram (weekToInputs + evaluate)', 200_000, () => recommendLevelViaProgram(week, 'C', CHALLENGES))
  timePerCall('recommendLevel (src/lib/program.ts, plain JS)', 200_000, () => recommendLevel(week, 'C', CHALLENGES))
}
