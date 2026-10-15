// Executable checks for the claims and code in NOTES-training.md.
//   npx tsx lab/handwired/notes-training-check.ts     prints each check and the fine-tuned values
//   npx vitest run lab/handwired                      runs the same checks as tests
//
// Two rule-initialized programs:
// - buildLevelProgram: src/lib/program.ts recommendLevel, with its three thresholds in trainable cells.
//   'exact' mode must equal recommendLevel; 'soft' mode replaces each comparison by a ramp for training.
// - buildExpectedDoneProgram: src/lib/personalize.ts's expected done share (Beta posterior mean), with
//   priorMean[1..3] and barrierBonus in trainable cells, fine-tuned by fineTunePriorMeans.
import {pathToFileURL} from 'node:url'
import {Circuit, emitCompare, emitRelu, emitSelect, type Wire} from './vendor/numeric-ui-core.ts'
import {completionRate, recommendLevel} from '../../src/lib/program.ts'
import {DEFAULT_PARAMS, posteriorMean, priorFor, rng} from '../../src/lib/personalize.ts'
import {makePerson} from '../../src/lib/simulate.ts'
import {CHALLENGES} from '../../src/data/challenges.ts'
import type {Challenge, ChallengeLevel, Commitment, WeekPlan} from '../../src/types.ts'

export type CheckResult = {label: string, ok: boolean, detail: string}

// ── 1. recommendLevel as a program with threshold cells ─────────────────────────────────────────

// Source table: the trainable cells first, then the inputs the host writes.
export const levelCell = {
  lowCut: 0, highCut: 1, dislikeCut: 2, // trainable: rate < lowCut steps down, rate >= highCut steps up, mean enjoyment <= dislikeCut blocks it
  has: 3, rate: 4, lv1: 5, lv2: 6, lv3: 7, hasRatings: 8, meanEnjoy: 9, // inputs
  sharpness: 10, // soft mode only: the ramp is 1/sharpness wide
} as const
export const levelRuleValues = {lowCut: 0.5, highCut: 0.8, dislikeCut: 2}

export function buildLevelProgram(mode: 'exact' | 'soft') {
  const c = new Circuit(11)
  const w = (i: number) => c.source(i)
  c.assumeRange(w(levelCell.lowCut), 0, 1)
  c.assumeRange(w(levelCell.highCut), 0, 1)
  c.assumeRange(w(levelCell.dislikeCut), 1, 5)
  c.assumeBit(w(levelCell.has))
  c.assumeRange(w(levelCell.rate), 0, 1)
  c.assumeOneHot([w(levelCell.lv1), w(levelCell.lv2), w(levelCell.lv3)], true)
  c.assumeBit(w(levelCell.hasRatings))
  c.assumeRange(w(levelCell.meanEnjoy), 1, 5)
  c.assumeRange(w(levelCell.sharpness), 1, 4096)
  // [a >= b]: an exact comparison at run time, a clamped ramp of width 1/sharpness while training.
  const atLeast = (a: Wire, b: Wire): Wire => {
    if (mode === 'exact') return emitCompare(c, a, '>=', b)
    const d = c.roundAffine([[a, 1], [b, -1]])
    const z = c.multiply(d, w(levelCell.sharpness))
    const r = c.reglu([], 1, [[z, 1]], 0.5) // relu(z + 0.5)
    return c.affine([[c.reglu([], 1, [[r, -1]], 1), -1]], 1) // 1 - relu(1 - r) = clamp01(z + 0.5)
  }
  const not = (x: Wire) => c.roundAffine([[x, -1]], 1)
  const geLow = atLeast(w(levelCell.rate), w(levelCell.lowCut))
  const high = atLeast(w(levelCell.rate), w(levelCell.highCut))
  const disliked = c.multiply(w(levelCell.hasRatings), atLeast(w(levelCell.dislikeCut), w(levelCell.meanEnjoy)))
  // rate < lowCut: one level down, but not below 1.
  const down = c.multiply(not(geLow), not(w(levelCell.lv1)))
  // otherwise, rate >= highCut, not disliked and at level 1: up to 2.
  const up = c.multiply(c.multiply(geLow, high), c.multiply(not(disliked), w(levelCell.lv1)))
  const delta = c.roundAffine([[w(levelCell.lv1), 1], [w(levelCell.lv2), 2], [w(levelCell.lv3), 3], [down, -1], [up, 1]], -1)
  const level = c.roundAffine([[c.multiply(w(levelCell.has), delta), 1]], 1)
  return {circuit: c, level}
}

// Host preprocessing: the reads recommendLevel does before deciding, written as numbers. The trainable
// cells (0..2) are left as they are.
export function levelInputs(prev: WeekPlan | undefined, trait: Challenge['trait'], library: Challenge[], source: Float32Array) {
  source.fill(0, levelCell.has)
  source[levelCell.meanEnjoy] = 3
  source[levelCell.sharpness] = 1
  if (!prev) return source
  const forTrait = prev.commitments.filter((x) => library.find((l) => l.id === x.challengeId)?.trait === trait)
  if (!forTrait.length) return source
  const levels = forTrait.map((x) => library.find((l) => l.id === x.challengeId)!.level)
  const avg = Math.min(3, Math.max(1, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)))
  const ratings = forTrait.map((x) => x.enjoyment).filter((e): e is number => e != null)
  source[levelCell.has] = 1
  source[levelCell.rate] = completionRate({...prev, commitments: forTrait})
  source[levelCell.lv1 + avg - 1] = 1
  if (ratings.length) {
    source[levelCell.hasRatings] = 1
    source[levelCell.meanEnjoy] = ratings.reduce((a, b) => a + b, 0) / ratings.length
  }
  return source
}

// ── 2. personalize.ts's expected done share as a program with prior cells ───────────────────────

const k = DEFAULT_PARAMS.priorStrength // fixed, written into coefficients (see the notes for why)
const techniqueWeight = DEFAULT_PARAMS.techniqueWeight
export const doneCell = {
  pm1: 0, pm2: 1, pm3: 2, bonus: 3, // trainable: DEFAULT_PARAMS.priorMean[1..3] and barrierBonus
  lv1: 4, lv2: 5, lv3: 6, fits: 7, ownSuccess: 8, techniqueSuccess: 9, reciprocal: 10, // inputs
} as const
export const doneTrainableCount = 4

export function buildExpectedDoneProgram() {
  const c = new Circuit(11)
  const w = (i: number) => c.source(i)
  c.assumeOneHot([w(doneCell.lv1), w(doneCell.lv2), w(doneCell.lv3)])
  c.assumeBit(w(doneCell.fits))
  c.assumeRange(w(doneCell.ownSuccess), 0, 1000)
  c.assumeRange(w(doneCell.techniqueSuccess), 0, 1000)
  c.assumeRange(w(doneCell.reciprocal), 0, 1)
  const raw = c.roundAffine([
    [c.multiply(w(doneCell.lv1), w(doneCell.pm1)), 1],
    [c.multiply(w(doneCell.lv2), w(doneCell.pm2)), 1],
    [c.multiply(w(doneCell.lv3), w(doneCell.pm3)), 1],
    [c.multiply(w(doneCell.fits), w(doneCell.bonus)), 1],
  ])
  // Math.min(0.95, Math.max(0.05, raw)) = 0.05 + relu(raw - 0.05) - relu(raw - 0.95)
  const mean = c.roundAffine([[c.reglu([], 1, [[raw, 1]], -0.05), 1], [c.reglu([], 1, [[raw, 1]], -0.95), -1]], 0.05)
  // alpha / (alpha + beta), alpha = k·mean + techniqueWeight·techniqueSuccess + ownSuccess. The host writes 1/(alpha + beta),
  // which doesn't depend on any trainable cell: alpha + beta = k + techniqueWeight·(its days) + own days.
  const alpha = c.roundAffine([[mean, k], [w(doneCell.techniqueSuccess), techniqueWeight], [w(doneCell.ownSuccess), 1]])
  return {circuit: c, expected: c.multiply(w(doneCell.reciprocal), alpha)}
}

export type DoneRecord = {success: number, failure: number}
export function expectedDoneInputs(source: Float32Array, level: ChallengeLevel, fits: boolean, own: DoneRecord, technique: DoneRecord) {
  source.fill(0, doneCell.lv1)
  source[doneCell.lv1 + level - 1] = 1
  source[doneCell.fits] = fits ? 1 : 0
  source[doneCell.ownSuccess] = own.success
  source[doneCell.techniqueSuccess] = technique.success
  source[doneCell.reciprocal] = 1 / (k + techniqueWeight * (technique.success + technique.failure) + own.success + own.failure)
  return source
}

// Examples with identical inputs share one forward and one backward pass: the gradient of a sum is the sum of gradients.
export type DoneGroup = {level: ChallengeLevel, fits: boolean, days: number, sumY: number}

// Logged first-week days of simulated people (src/lib/simulate.ts's people and day loop): done = 1, partly = 0.5,
// skipped = 0, the counting personalize.ts uses. Unlogged and no-chance days say nothing and are dropped.
export function simulatedFirstWeekDays(people: number, seed: number, trait: Challenge['trait'] = 'C'): DoneGroup[] {
  const pool = CHALLENGES.filter((c) => c.trait === trait)
  const groups = new Map<number, DoneGroup>()
  for (let i = 0; i < people; i++) {
    const person = makePerson(CHALLENGES, seed * 100003 + i)
    const u = rng(seed * 31 + i)
    for (const ch of pool) {
      for (let d = 0; d < 7; d++) {
        if (u() < person.missing) continue
        if (u() > person.opportunity) continue
        const r = u()
        const p = person.p[ch.id]!
        const y = r < p ? 1 : r < p + (1 - p) * 0.25 ? 0.5 : 0
        const group = groups.get(ch.level) ?? {level: ch.level, fits: false, days: 0, sumY: 0}
        group.days++
        group.sumY += y
        groups.set(ch.level, group)
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.level - b.level)
}

// Full-batch Adam on the mean squared error of the expected done share, with an optional pull toward the rule's
// values (anchor), so that fine-tuning stays near the rule where the data says little.
export function fineTunePriorMeans(
  groups: readonly DoneGroup[],
  options: {epochs?: number, learningRate?: number, anchor?: number} = {},
) {
  const {epochs = 600, learningRate = 0.01, anchor = 0} = options
  const {circuit, expected} = buildExpectedDoneProgram()
  const source = new Float32Array(circuit.sourceSize)
  const rule = [DEFAULT_PARAMS.priorMean[1], DEFAULT_PARAMS.priorMean[2], DEFAULT_PARAMS.priorMean[3], DEFAULT_PARAMS.barrierBonus]
  source.set(rule)
  const first = new Float64Array(doneTrainableCount)
  const second = new Float64Array(doneTrainableCount)
  const total = groups.reduce((sum, g) => sum + g.days, 0)
  const none = {success: 0, failure: 0}
  for (let epoch = 1; epoch <= epochs; epoch++) {
    const gradient = new Float64Array(doneTrainableCount)
    for (const group of groups) {
      expectedDoneInputs(source, group.level, group.fits, none, none)
      const values = circuit.evaluateReference(source)
      const outputGradients = new Float32Array(values.length)
      // d/d(prediction) of (1/total)·Σ(prediction − y)² over the group's days
      outputGradients[expected] = (2 * (group.days * values[expected]! - group.sumY)) / total
      const backward = circuit.backpropagateReference(values, outputGradients)
      for (let p = 0; p < doneTrainableCount; p++) gradient[p]! += backward[p]!
    }
    for (let p = 0; p < doneTrainableCount; p++) {
      const g = gradient[p]! + anchor * (source[p]! - rule[p]!)
      first[p] = 0.9 * first[p]! + 0.1 * g
      second[p] = 0.999 * second[p]! + 0.001 * g * g
      const step = (learningRate * (first[p]! / (1 - 0.9 ** epoch))) / (Math.sqrt(second[p]! / (1 - 0.999 ** epoch)) + 1e-8)
      source[p] = Math.fround(source[p]! - step) // write the trained coefficient back into the program's source table
    }
  }
  return {source, circuit, expected, rule}
}

// ── checks ──────────────────────────────────────────────────────────────────────────────────────

function gradientOf(circuit: Circuit, source: Float32Array, output: Wire, options = {}) {
  const values = circuit.evaluateReference(source)
  const seed = new Float32Array(values.length)
  seed[output] = 1
  return circuit.backpropagateReference(values, seed, options)
}

function throwsWith(run: () => unknown): string | null {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const challenge = (id: string, trait: 'C' | 'E', level: ChallengeLevel): Challenge =>
  ({id, trait, technique: 't', level, title: id, instructions: '', perWeek: 3, minutes: 5, ifThenExample: ''})

export function enumerateLevelCases() {
  const library = [challenge('c1', 'C', 1), challenge('c2', 'C', 2), challenge('c3', 'C', 3), challenge('e1', 'E', 2)]
  const options: Commitment[] = []
  for (const level of [1, 2, 3]) {
    for (let target = 1; target <= 7; target++) {
      for (let done = 0; done <= target + 1; done++) {
        for (const enjoyment of [undefined, 1, 2, 3, 4, 5]) {
          options.push({challengeId: `c${level}`, ifThen: '', confidence: 5, target, completions: Array.from({length: done}, (_, i) => `d${i}`), enjoyment})
        }
      }
    }
  }
  const week = (commitments: Commitment[]): WeekPlan => ({weekIndex: 0, startDate: '2026-01-05', commitments})
  const cases: (WeekPlan | undefined)[] = [undefined, week([]), week([{challengeId: 'e1', ifThen: '', confidence: 5, target: 3, completions: ['a', 'b', 'c']}])]
  for (const a of options) cases.push(week([a]), week([a, {challengeId: 'e1', ifThen: '', confidence: 5, target: 2, completions: []}]))
  for (const a of options) for (const b of options) cases.push(week([a, b]))
  return {library, cases}
}

export function runNotesTrainingChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (label: string, ok: boolean, detail = '') => results.push({label, ok, detail})

  // What gets a gradient.
  {
    const c = new Circuit(2) // cell 0 = x, cell 1 = w
    const baked = c.affine([[c.source(0), 0.5]])
    const viaCell = c.multiply(c.source(1), c.source(0))
    const s = Float32Array.of(3, 0.5)
    const g1 = gradientOf(c, s, baked)
    const g2 = gradientOf(c, s, viaCell)
    check('a number written into a term gets no gradient slot; the same number in a cell gets d/dw',
      g1.length === c.sourceSize + c.operations.length && g1[0] === 0.5 && g1[1] === 0 && g2[1] === 3 && g2[0] === 0.5,
      `baked: dx=${g1[0]} dw=${g1[1]}; cell: dx=${g2[0]} dw=${g2[1]}`)
  }
  {
    const c = new Circuit(2)
    const m = c.multiply(c.source(0), c.source(1))
    const g = gradientOf(c, Float32Array.of(3, 0), m)
    const c2 = new Circuit(1)
    const r = emitRelu(c2, c2.source(0))
    const atCorner = gradientOf(c2, Float32Array.of(0), r)[0]
    const above = gradientOf(c2, Float32Array.of(2), r)[0]
    check('multiply macro: d(a·x)/dx = a even at x = 0; ReLU slope is 0 at its corner, 1 above', g[1] === 3 && atCorner === 0 && above === 1,
      `d/dx=${g[1]} relu'(0)=${atCorner} relu'(2)=${above}`)
  }
  {
    const c = new Circuit(3)
    c.assumeRange(c.source(0), 0, 1)
    const sel = emitSelect(c, c.source(0), c.source(1), c.source(2))
    const g = gradientOf(c, Float32Array.of(0.25, 10, 40), sel)
    check('select macro: dgate = on − off, doff = 1 − gate, don = gate', g[0] === 30 && g[1] === 0.75 && g[2] === 0.25, `${g[0]}, ${g[1]}, ${g[2]}`)
  }
  {
    const c = new Circuit(1)
    c.assumeRange(c.source(0), 0, 1)
    const b = c.boolean(c.source(0))
    const thrown = throwsWith(() => gradientOf(c, Float32Array.of(0.7), b))
    const straight = gradientOf(c, Float32Array.of(0.7), b, {booleanGradient: 'straight-through'})[0]
    check('boolean atom: backward throws by default, passes the gradient unchanged with straight-through',
      thrown === 'cannot backpropagate through a boolean atom' && straight === 1, `${thrown}; straight-through ${straight}`)
  }
  {
    const c = new Circuit(5)
    c.assumeRange(c.source(0), 0, 3)
    const read = c.indexRead(c.source(0), [c.source(1), c.source(2), c.source(3), c.source(4)])
    const s = Float32Array.of(2, 28, 44, 28, 60)
    const thrown = throwsWith(() => gradientOf(c, s, read))
    const zero = Array.from(gradientOf(c, s, read, {indexGradient: 'zero'}).slice(0, 5))
    const backward = Array.from(gradientOf(c, s, read, {indexGradient: 'backward-difference'}).slice(0, 5))
    check('index read: the selected table cell gets the gradient; the index throws, gets 0, or read(i) − read(i − 1)',
      thrown !== null && zero.join() === '0,0,0,1,0' && backward.join() === '-16,0,0,1,0', `zero ${zero}; backward-difference ${backward}`)
  }
  {
    const c = new Circuit(2)
    c.assumeRange(c.source(0), 0, 1)
    c.assumeRange(c.source(1), 0, 1)
    const bit = emitCompare(c, c.source(0), '>=', c.source(1))
    const g = gradientOf(c, Float32Array.of(0.6, 0.5), bit)
    check('emitCompare on continuous operands (sign cascade): exact bit, gradient 0 to both operands', g[0] === 0 && g[1] === 0, `d=${g[0]}, ${g[1]}`)
  }

  // recommendLevel, exactly.
  {
    const {circuit, level} = buildLevelProgram('exact')
    const evaluate = circuit.createTensorEvaluator([level])
    const source = new Float32Array(circuit.sourceSize)
    source[levelCell.lowCut] = levelRuleValues.lowCut
    source[levelCell.highCut] = levelRuleValues.highCut
    source[levelCell.dislikeCut] = levelRuleValues.dislikeCut
    const {library, cases} = enumerateLevelCases()
    let mismatches = 0
    let referenceMismatches = 0
    for (let i = 0; i < cases.length; i++) {
      levelInputs(cases[i], 'C', library, source)
      const got = evaluate(source)[0]
      if (got !== recommendLevel(cases[i], 'C', library)) mismatches++
      if (i % 997 === 0 && circuit.evaluateReference(source)[level] !== got) referenceMismatches++
    }
    const program = circuit.compileTensorProgram([level])
    check('exact level program at the rule\'s cut values equals recommendLevel on every enumerated week',
      mismatches === 0 && referenceMismatches === 0,
      `${cases.length} weeks, ${mismatches} mismatches, ${referenceMismatches} reference/tensor mismatches; ${program.valueCount - program.sourceSize} live ops, ${program.layers.length} layers`)
  }
  {
    const soft = buildLevelProgram('soft')
    const s = new Float32Array(soft.circuit.sourceSize)
    const probe = (avg: 1 | 2, rate: number) => {
      s.set([0.5, 0.8, 2, 1, rate, avg === 1 ? 1 : 0, avg === 2 ? 1 : 0, 0, 0, 3, 8])
      const values = soft.circuit.evaluateReference(s)
      const g = gradientOf(soft.circuit, s, soft.level)
      return {level: values[soft.level]!, low: g[levelCell.lowCut]!, high: g[levelCell.highCut]!}
    }
    const nearLow = probe(2, 0.45)
    const farLow = probe(2, 0.2)
    const nearHigh = probe(1, 0.78)
    check('soft level program (sharpness 8): a cut gets gradient −sharpness within half a ramp of it, 0 elsewhere',
      Math.abs(nearLow.level - 1.1) < 1e-6 && nearLow.low === -8 && farLow.low === 0 && Math.abs(nearHigh.level - 1.34) < 1e-6 && nearHigh.high === -8,
      `rate .45 @2: level ${nearLow.level.toFixed(4)} dlowCut ${nearLow.low}; rate .2 @2: dlowCut ${farLow.low}; rate .78 @1: level ${nearHigh.level.toFixed(4)} dhighCut ${nearHigh.high}`)
  }

  // The expected done share, at the rule's values, then fine-tuned.
  {
    const {circuit, expected} = buildExpectedDoneProgram()
    const evaluate = circuit.createTensorEvaluator([expected])
    const source = new Float32Array(circuit.sourceSize)
    source.set([DEFAULT_PARAMS.priorMean[1], DEFAULT_PARAMS.priorMean[2], DEFAULT_PARAMS.priorMean[3], DEFAULT_PARAMS.barrierBonus])
    let cases = 0
    let equal = 0
    let maxDiff = 0
    const halves = Array.from({length: 13}, (_, i) => i / 2)
    for (const level of [1, 2, 3] as const) {
      for (const fits of [false, true]) {
        for (const ownSuccess of halves) for (const ownFailure of halves) for (const ts of [0, 1, 2.5, 6]) for (const tf of [0, 1, 3.5]) {
          const prior = priorFor({level} as Challenge, {fitsBarrier: fits, technique: {success: ts, failure: tf}})
          const js = posteriorMean({alpha: prior.alpha + ownSuccess, beta: prior.beta + ownFailure})
          expectedDoneInputs(source, level, fits, {success: ownSuccess, failure: ownFailure}, {success: ts, failure: tf})
          const got = evaluate(source)[0]!
          cases++
          if (got === Math.fround(js)) equal++
          maxDiff = Math.max(maxDiff, Math.abs(got - js))
        }
      }
    }
    check('expected-done program at DEFAULT_PARAMS equals personalize.ts within FP32 rounding',
      maxDiff < 2e-7, `${cases} cases, ${equal} bit-equal to Math.fround(JS), max |program − JS| = ${maxDiff.toExponential(2)}`)

    const s = expectedDoneInputs(Float32Array.from(source), 1, false, {success: 2, failure: 1}, {success: 0, failure: 0})
    const backward = gradientOf(circuit, s, expected)[doneCell.pm1]!
    const h = 1e-3
    const at = (v: number) => {
      const t = Float32Array.from(s)
      t[doneCell.pm1] = v
      return circuit.evaluateReference(t)[expected]!
    }
    const central = (at(0.7 + h) - at(0.7 - h)) / (2 * h)
    check('backward pass equals a central difference: d expected / d priorMean[1] = k / (k + n)',
      Math.abs(backward - k / (k + 3)) < 1e-6 && Math.abs(central - backward) < 1e-4, `backward ${backward}, central ${central}, k/(k+n) ${k / (k + 3)}`)
  }
  {
    const groups = simulatedFirstWeekDays(300, 7)
    const tuned = fineTunePriorMeans(groups)
    const empirical = groups.map((g) => g.sumY / g.days)
    const learned = [tuned.source[0]!, tuned.source[1]!, tuned.source[2]!]
    check('fine-tuning (no anchor) moves priorMean[1..3] to the training days\' mean done share; barrierBonus has no data and stays',
      learned.every((v, i) => Math.abs(v - empirical[i]!) < 1e-3) && tuned.source[3] === Math.fround(DEFAULT_PARAMS.barrierBonus),
      `rule ${tuned.rule.slice(0, 3).join(', ')} -> learned ${learned.map((v) => v.toFixed(4)).join(', ')}; data mean ${empirical.map((v) => v.toFixed(4)).join(', ')}; ${groups.reduce((a, g) => a + g.days, 0)} days`)
    const anchor = 0.1
    const anchored = fineTunePriorMeans(groups, {anchor, epochs: 1500})
    const total = groups.reduce((a, g) => a + g.days, 0)
    // Minimizer of (1/N)Σ(θ − y)² + (anchor/2)(θ − θ_rule)²: θ = (2·n/N·ȳ + anchor·θ_rule) / (2·n/N + anchor)
    const closedForm = groups.map((g, i) => ((2 * g.days / total) * empirical[i]! + anchor * tuned.rule[i]!) / ((2 * g.days) / total + anchor))
    const anchoredValues = [anchored.source[0]!, anchored.source[1]!, anchored.source[2]!]
    check('fine-tuning with an anchor toward the rule lands on the closed-form compromise',
      anchoredValues.every((v, i) => Math.abs(v - closedForm[i]!) < 1e-3),
      `anchor ${anchor}: learned ${anchoredValues.map((v) => v.toFixed(4)).join(', ')}; closed form ${closedForm.map((v) => v.toFixed(4)).join(', ')}`)
  }
  return results
}

// The simulator's population answer, for the report only: E[y] = p + 0.125·(1 − p) averaged over fresh people.
function simulatorPopulationMeans(people: number) {
  const pool = CHALLENGES.filter((c) => c.trait === 'C')
  const sum = [0, 0, 0]
  const count = [0, 0, 0]
  for (let i = 0; i < people; i++) {
    const person = makePerson(CHALLENGES, 9_000_000 + i)
    for (const ch of pool) {
      const p = person.p[ch.id]!
      sum[ch.level - 1]! += p + 0.125 * (1 - p)
      count[ch.level - 1]!++
    }
  }
  return sum.map((s, i) => s / count[i]!)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const start = performance.now()
  const results = runNotesTrainingChecks()
  for (const {label, ok, detail} of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`)
  const failed = results.filter((result) => !result.ok).length
  console.log(`${results.length - failed}/${results.length} checks passed in ${(performance.now() - start).toFixed(0)} ms on Node ${process.version}`)
  console.log(`simulator population mean done share by level (5,000 fresh people): ${simulatorPopulationMeans(5000).map((v) => v.toFixed(4)).join(', ')}`)
  if (failed > 0) process.exit(1)
}
