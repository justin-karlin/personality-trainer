// Compares the Handwired program in recommend-level.ts with the real recommendLevel (src/lib/program.ts).
//   npx vitest run lab/handwired/recommend-level
// (a) an exhaustive grid of program inputs, each realized as a WeekPlan the real function reads;
// (b) random WeekPlans built from the real CHALLENGES library;
// (c) the FP32 threshold argument from recommend-level.ts's header, checked on the program itself.
// Every case must match with ===.
import {describe, expect, it} from 'vitest'
import {validateGrids, validateNoNaN, validateTensorEvaluation} from './vendor/numeric-ui-core.ts'
import {
  buildRecommendLevelProgram, evaluate, evaluateFast, programSize, RULE, weekToInputs, writeInputs, type LevelInputs,
} from './recommend-level.ts'
import {recommendLevel} from '../../src/lib/program.ts'
import {CHALLENGES} from '../../src/data/challenges.ts'
import type {Challenge, ChallengeLevel, Commitment, TraitId, WeekPlan} from '../../src/types.ts'

const TRAITS: TraitId[] = ['N', 'E', 'O', 'A', 'C']
const program = buildRecommendLevelProgram()
const {circuit} = program
const referenceSource = new Float32Array(program.initialSource)

// Checks one input against the reference evaluator (every wire) as well: tensor === reference, no NaN, grids hold.
function deepCheck(inputs: LevelInputs) {
  writeInputs(program, inputs, referenceSource)
  const values = circuit.evaluateReference(referenceSource)
  validateNoNaN(circuit, values)
  validateGrids(circuit, values)
  validateTensorEvaluation(referenceSource, circuit, circuit.evaluateTensor(referenceSource))
  return values[program.output.level]
}

const dates = Array.from({length: 40}, (_, i) => `2026-01-${String(1 + (i % 28)).padStart(2, '0')}#${i}`)
function commitment(ch: Challenge, target: number, done: number, enjoyment?: number): Commitment {
  return {challengeId: ch.id, ifThen: '', confidence: 7, target, completions: dates.slice(0, done), ...(enjoyment != null ? {enjoyment} : {})}
}
function week(commitments: Commitment[]): WeekPlan {
  return {weekIndex: 3, startDate: '2026-01-19', commitments}
}
const byTraitLevel = (t: TraitId, l: ChallengeLevel) => CHALLENGES.filter((c) => c.trait === t && c.level === l)

describe('program size and structure', () => {
  it('reports its size', () => {
    const size = programSize(program)
    console.log('recommend-level program size:', JSON.stringify(size))
    expect(size.sourceCells).toBe(5)
    expect(size.liveOps).toBeLessThan(64)
  })
})

describe('(a) exhaustive input grid, realized as WeekPlans', () => {
  // Grid: rate k/n for every target total n = 1..14 and done k = 0..n; rounded average level 1..3; enjoyment absent or
  // a mean of 1, 1.25, ..., 5; for each of the 5 traits. Each point becomes a WeekPlan: commitments of the trait at that
  // level (targets summing to n, k completions spread without exceeding any target), enough rated commitments to give
  // the mean (1, 2 or 4 ratings for whole, half and quarter means), plus one other-trait commitment that recommendLevel
  // must ignore. When a quarter mean needs more rated commitments than n allows, the extra ones get target 0 (allowed by
  // the data model, not by the UI's 1..7 slider), which leaves the rate at k/n.
  function realize(trait: TraitId, n: number, k: number, level: ChallengeLevel, mean: number | undefined, variant: number): WeekPlan {
    const pool = byTraitLevel(trait, level)
    const ratings: number[] = []
    if (mean !== undefined) {
      const r = Number.isInteger(mean) ? 1 : Number.isInteger(mean * 2) ? 2 : 4
      const sum = Math.round(mean * r)
      for (let i = 0; i < r; i++) ratings.push(Math.floor(sum / r) + (i < sum % r ? 1 : 0))
    }
    const count = Math.max(1, ratings.length, Math.min(n, 1 + (variant % 3))) // 1..3 commitments unless ratings need more
    const targets = Array.from({length: count}, (_, i) => Math.floor(n / count) + (i < n % count ? 1 : 0))
    let left = k
    const commitments = targets.map((t, i) => {
      const done = Math.min(t, left)
      left -= done
      return commitment(pool[(i + variant) % pool.length]!, t, done, ratings[i])
    })
    const other = CHALLENGES.find((c) => c.trait !== trait && c.level !== level)!
    commitments.splice(variant % (commitments.length + 1), 0, commitment(other, 3, variant % 4, 1 + (variant % 5)))
    return week(commitments)
  }

  it('matches recommendLevel on every grid point (and the WeekPlan reproduces the grid point)', () => {
    const means: (number | undefined)[] = [undefined, ...Array.from({length: 17}, (_, i) => 1 + i / 4)]
    let cases = 0
    let mismatches = 0
    let roundTripMismatches = 0
    let referenceMismatches = 0
    const outputs = {1: 0, 2: 0, 3: 0}
    const failures: string[] = []
    let variant = 0
    for (const trait of TRAITS) {
      for (let n = 1; n <= 14; n++) {
        for (let k = 0; k <= n; k++) {
          for (const level of [1, 2, 3] as ChallengeLevel[]) {
            for (const mean of means) {
              const plan = realize(trait, n, k, level, mean, variant++)
              const inputs = weekToInputs(plan, trait, CHALLENGES)
              const intended: LevelInputs = {has: 1, avgLevel: level, rate: k / n, hasRatings: mean === undefined ? 0 : 1, meanEnjoyment: mean ?? 0}
              if (JSON.stringify(inputs) !== JSON.stringify(intended)) roundTripMismatches++
              const got = evaluateFast(inputs)
              const want = recommendLevel(plan, trait, CHALLENGES)
              cases++
              outputs[got]++
              if (got !== want) {
                mismatches++
                if (failures.length < 5) failures.push(`${trait} ${k}/${n} L${level} mean ${mean}: program ${got}, rule ${want}`)
              }
              if (cases % 17 === 0 && deepCheck(inputs) !== got) referenceMismatches++
            }
          }
        }
      }
      // has = 0: no previous week, an empty week, and a week with only other traits' commitments.
      const others = CHALLENGES.filter((c) => c.trait !== trait).slice(0, 3)
      for (const plan of [undefined, week([]), week(others.map((c, i) => commitment(c, 2 + i, i, 1 + i)))]) {
        const got = evaluate(weekToInputs(plan, trait, CHALLENGES))
        cases++
        outputs[got]++
        if (got !== recommendLevel(plan, trait, CHALLENGES)) mismatches++
      }
    }
    console.log(`(a) grid: ${cases} cases, ${mismatches} mismatches, ${roundTripMismatches} round-trip mismatches, ` +
      `${referenceMismatches} reference/tensor mismatches; outputs ${JSON.stringify(outputs)}`)
    expect(failures).toEqual([])
    expect(mismatches).toBe(0)
    expect(roundTripMismatches).toBe(0)
    expect(referenceMismatches).toBe(0)
    expect(cases).toBe(5 * 119 * 3 * 18 + 5 * 3)
  })

  it('returns 1 whenever has = 0, whatever the other cells hold', () => {
    // weekToInputs always writes avgLevel 1 with has = 0, so the grid above never tests the program's own has-gating.
    let cases = 0
    let wrong = 0
    for (const avgLevel of [1, 2, 3] as ChallengeLevel[]) {
      for (let n = 1; n <= 14; n++) {
        for (let k = 0; k <= n; k++) {
          for (const meanEnjoyment of [0, 1, 2, 2.25, 5]) {
            cases++
            if (evaluate({has: 0, avgLevel, rate: k / n, hasRatings: meanEnjoyment ? 1 : 0, meanEnjoyment}) !== 1) wrong++
          }
        }
      }
    }
    expect(cases).toBe(3 * 119 * 5)
    expect(wrong).toBe(0)
  })

  it('handles the threshold-exact rates and means: 1/2, 4/5, 8/10, 12/15 and a mean of exactly 2', () => {
    const at = (avgLevel: ChallengeLevel, rate: number, meanEnjoyment = 0): LevelInputs =>
      ({has: 1, avgLevel, rate, hasRatings: meanEnjoyment ? 1 : 0, meanEnjoyment})
    expect(evaluate(at(2, 1 / 2))).toBe(2) //         0.5 is not < 0.5: no step down
    expect(evaluate(at(2, 6 / 13))).toBe(1) //        just below 0.5: step down
    for (const [k, n] of [[4, 5], [8, 10], [12, 15], [20, 25], [44, 55]]) {
      expect(k / n >= 0.8).toBe(true)
      expect(evaluate(at(1, k / n))).toBe(2) //       exactly 0.8: step up
      expect(evaluate(at(1, k / n, 2))).toBe(1) //    ...unless the mean rating is exactly 2 (disliked)
      expect(evaluate(at(1, k / n, 2.25))).toBe(2)
    }
    expect(evaluate(at(1, 11 / 14))).toBe(1) //       0.7857 < 0.8
  })
})

describe('(b) random WeekPlans from the real CHALLENGES library', () => {
  // A seeded LCG so failures reproduce.
  function rng(seed: number) {
    let s = seed >>> 0
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  }

  it('matches recommendLevel on 30,000 random weeks', () => {
    const random = rng(20261015)
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!
    const unknown: Challenge = {...CHALLENGES[0]!, id: 'not-in-library'}
    let cases = 0
    let mismatches = 0
    const failures: string[] = []
    const seen = {stepDown: 0, stepUp: 0, blockedByDislike: 0, keep: 0, none: 0}
    for (let i = 0; i < 30_000; i++) {
      const trait = pick(TRAITS)
      let plan: WeekPlan | undefined
      if (random() < 0.03) {
        plan = undefined
      } else {
        // 0..7 commitments; mostly the chosen trait so that branches are exercised, some other traits, a few unknown ids.
        const count = Math.floor(random() * 8)
        const commitments: Commitment[] = []
        for (let j = 0; j < count; j++) {
          const u = random()
          const ch = u < 0.02 ? unknown : u < 0.7 ? pick(CHALLENGES.filter((c) => c.trait === trait)) : pick(CHALLENGES)
          const target = random() < 0.85 ? ch.perWeek : 1 + Math.floor(random() * 7) // 1..7, as the planner allows
          const done = Math.floor(random() * (target + 3)) // over-target completions get capped by completionRate
          const enjoyment = random() < 0.45 ? undefined : 1 + Math.floor(random() * 5)
          commitments.push(commitment(ch, target, Math.min(done, dates.length), enjoyment))
        }
        plan = week(commitments)
      }
      const inputs = weekToInputs(plan, trait, CHALLENGES)
      const got = evaluateFast(inputs)
      const want = recommendLevel(plan, trait, CHALLENGES)
      cases++
      if (got !== want) {
        mismatches++
        if (failures.length < 5) failures.push(`${JSON.stringify(inputs)}: program ${got}, rule ${want}`)
      }
      if (i % 25 === 0 && deepCheck(inputs) !== got) mismatches++
      if (!inputs.has) seen.none++
      else if (inputs.rate < RULE.stepDownBelow) seen.stepDown++
      else if (inputs.rate >= RULE.stepUpAtLeast && inputs.avgLevel === 1) seen[inputs.hasRatings && inputs.meanEnjoyment <= 2 ? 'blockedByDislike' : 'stepUp']++
      else seen.keep++
    }
    console.log(`(b) random weeks: ${cases} cases, ${mismatches} mismatches; branches ${JSON.stringify(seen)}`)
    expect(failures).toEqual([])
    expect(mismatches).toBe(0)
    for (const count of Object.values(seen)) expect(count).toBeGreaterThan(100)
  })
})

describe('(c) FP32 threshold handling', () => {
  const bits = circuit.createTensorEvaluator([program.output.weak, program.output.strongRate, program.output.lowEnjoyment])
  const source = new Float32Array(program.initialSource)

  it('the program\'s comparison bits equal JS on k/n and s/m next to each threshold, for n, m up to 100,000', () => {
    // f is monotone, so only the k (or s) nearest a threshold can flip; everything farther away compares the same.
    let checked = 0
    let flips = 0
    for (let n = 1; n <= 100_000; n++) {
      for (const k of [Math.floor(n / 2) - 1, Math.floor(n / 2), Math.ceil(n / 2), Math.floor(0.8 * n) - 1, Math.floor(0.8 * n), Math.ceil(0.8 * n), Math.ceil(0.8 * n) + 1]) {
        if (k < 0 || k > n) continue
        const rate = k / n
        // Enjoyment mean s/n of n integer ratings in 1..5 next to 2.
        const s = 2 * n + (k % 3) - 1
        const mean = s / n
        writeInputs(program, {has: 1, avgLevel: 1, rate, hasRatings: 1, meanEnjoyment: mean}, source)
        const [weak, strong, low] = bits(source)
        checked++
        if (weak !== (rate < 0.5 ? 1 : 0) || strong !== (rate >= 0.8 ? 1 : 0) || low !== (mean <= 2 ? 1 : 0)) flips++
      }
    }
    console.log(`(c) threshold sweep: ${checked} near-threshold rates/means, ${flips} flips`)
    expect(flips).toBe(0)
  })

  it('domain (reviewer): exactness assumes integer ratings 1..5; other stored values throw or can disagree', () => {
    const ch = CHALLENGES.find((c) => c.trait === 'C' && c.level === 1)!
    const plan = (enjoyment: number) => week([commitment(ch, 5, 4, enjoyment)]) // rate 0.8 at level 1
    expect(recommendLevel(plan(6), 'C', CHALLENGES)).toBe(2)
    expect(() => evaluate(weekToInputs(plan(6), 'C', CHALLENGES))).toThrow(/meanEnjoyment/)
    // 2.0000001 > 2 in float64 (not disliked: step up), but rounds to f(2) in the FP32 source table (disliked).
    expect(recommendLevel(plan(2.0000001), 'C', CHALLENGES)).toBe(2)
    expect(evaluate(weekToInputs(plan(2.0000001), 'C', CHALLENGES))).toBe(1)
  })

  it('computing the rate inside FP32 (done × f(1/target)) would be wrong: 20/25 lands below f(0.8)', () => {
    // The hazard the design avoids by rounding the float64 quotient once.
    const viaReciprocal = Math.fround(20 * Math.fround(1 / 25))
    expect(20 / 25 >= 0.8).toBe(true)
    expect(viaReciprocal < Math.fround(0.8)).toBe(true)
    expect(Math.fround(20 / 25)).toBe(Math.fround(0.8)) // rounding once lands exactly on the threshold constant
  })
})
