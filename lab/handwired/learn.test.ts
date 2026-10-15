// Fast checks of the plumbing behind learn.ts (the full experiment is `npx tsx lab/handwired/learn.ts`).
import {describe, expect, it} from 'vitest'
import {makePerson, simulate} from '../../src/lib/simulate.ts'
import {challengeRecords, rankChallenges} from '../../src/lib/personalize.ts'
import {recommendLevel} from '../../src/lib/program.ts'
import {CHALLENGES} from '../../src/data/challenges.ts'
import type {AppState} from '../../src/types.ts'
import {
  BETA_DEFAULT, POOL, SETTINGS, TRAIT, batchGradient, betaDefault, betaPredict, buildHwModel, featuresFor, generateExamples,
  hwPredictor, logLoss, unsupportedLevels, makePersonVariant, records, runExperiment, runPerson, rulesPicker, thompsonPicker, trainHw, writeInputs,
} from './learn.ts'
import {validateNoNaN, validateTensorEvaluation} from './vendor/numeric-ui-core.ts'

describe('learn.ts: simulator adapter', () => {
  it('makePersonVariant equals src makePerson at the default settings and at techniqueCorrelation 0', () => {
    for (const seed of [1, 42, 99_999]) {
      expect(makePersonVariant(CHALLENGES, seed, SETTINGS.default!)).toEqual(makePerson(CHALLENGES, seed))
      expect(makePersonVariant(CHALLENGES, seed, SETTINGS.tc0!)).toEqual(makePerson(CHALLENGES, seed, 0))
    }
  })

  it('runPerson reproduces simulate() exactly for the rules and thompson policies', () => {
    for (let i = 0; i < 6; i++) {
      const person = makePerson(CHALLENGES, 1000 + i)
      expect(runPerson(person, rulesPicker, 12, 77 + i)).toEqual(simulate(person, CHALLENGES, 'rules', 12, 77 + i))
      expect(runPerson(person, thompsonPicker(), 12, 77 + i)).toEqual(simulate(person, CHALLENGES, 'thompson', 12, 77 + i))
    }
  })

  it('records and betaDefault match personalize.ts (challengeRecords, rankChallenges expected)', () => {
    let checked = 0
    runPerson(makePerson(CHALLENGES, 5), thompsonPicker(), 8, 11, (before: AppState, w) => {
      const mine = records(before.weeks)
      for (const [id, r] of challengeRecords(before)) {
        const m = mine.get(id)!
        expect([m.done + m.partly / 2, m.skipped + m.partly / 2, m.done, m.done + m.partly + m.skipped, m.weeks])
          .toEqual([r.success, r.failure, r.doneDays, r.loggedDays, r.weeks])
      }
      const level = recommendLevel(before.weeks.at(-1), TRAIT, CHALLENGES)
      const expected = new Map(rankChallenges(before, {trait: TRAIT, library: CHALLENGES, level, seed: w}).map((s) => [s.challenge.id, s.expected]))
      for (const f of featuresFor(before)) {
        expect(betaDefault(f)).toBe(expected.get(f.challenge.id))
        expect(betaPredict(f, BETA_DEFAULT)).toBeCloseTo(betaDefault(f), 12)
        checked++
      }
    })
    expect(checked).toBe(8 * POOL.length)
  })

  it('examples use previous weeks only and start at the second week', () => {
    const ex = generateExamples(SETTINGS.default!, 9, 'train', 5)
    expect(ex.length).toBeGreaterThan(0)
    expect(Math.min(...ex.map((e) => e.week))).toBe(1)
    // Week w's features can only hold weeks 0..w-1: at most w planned weeks and 7·w logged days of a challenge.
    for (const e of ex) {
      const own = e.f.own
      expect((own?.weeks ?? 0) <= e.week && (own ? own.done + own.partly + own.skipped : 0) <= 7 * e.week).toBe(true)
      expect(e.d <= e.n && e.n <= 7).toBe(true)
    }
  })
})

describe('learn.ts: the Handwired predictor', () => {
  const examples = generateExamples(SETTINGS.default!, 3, 'train', 40)

  it('at init equals personalize.ts posterior mean to FP32 rounding (reference and compiled evaluators)', () => {
    const m = buildHwModel(false)
    const fast = hwPredictor(m)
    let maxDiff = 0
    for (const [i, e] of examples.entries()) {
      maxDiff = Math.max(maxDiff, Math.abs(fast(e.f) - betaDefault(e.f)))
      if (i % 50 === 0) {
        writeInputs(m, e.f)
        const values = m.circuit.evaluateReference(m.source)
        validateNoNaN(m.circuit, values)
        validateTensorEvaluation(m.source, m.circuit, m.circuit.evaluateTensor(m.source))
        expect(values[m.pred]).toBe(fast(e.f))
      }
    }
    expect(maxDiff).toBeLessThan(2e-7)
  })

  it('backpropagateReference gradients match central differences of the loss', () => {
    const m = buildHwModel(true, 2)
    const u = (i: number) => Math.sin(i * 12.9898) * 0.3
    for (let j = 0; j < 8; j++) m.source[m.layout.v + j] = u(j + 1) // non-zero output weights so every cell has a gradient
    const batch = examples.slice(0, 64)
    const {grad} = batchGradient(m, batch)
    const loss = () => logLoss(batch, hwPredictor(m))
    const cells = [m.layout.pm, m.layout.pm + 1, m.layout.pm + 2, m.layout.c0, ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((j) => [m.layout.v + j, m.layout.b1 + j, m.layout.wBase + j, m.layout.w1 + j * 13 + 5])]
    let compared = 0
    for (const p of cells) {
      if (Math.abs(grad[p]!) < 1e-3) continue
      const keep = m.source[p]!
      const h = 1e-3 // small enough to stay off ReLU corners, large enough for FP32 predictions
      m.source[p] = keep + h
      const up = loss()
      m.source[p] = keep - h
      const down = loss()
      m.source[p] = keep
      const central = (up - down) / (2 * h)
      expect(Math.abs(central - grad[p]!) / Math.abs(grad[p]!), `cell ${p}: backward ${grad[p]} central ${central}`).toBeLessThan(0.02)
      compared++
    }
    expect(compared).toBeGreaterThanOrEqual(10)
  })

  it('a short training run lowers the training loss and keeps the best validation epoch', () => {
    const train = examples.filter((e) => e.person < 32)
    const val = examples.filter((e) => e.person >= 32)
    const m = buildHwModel(false)
    const r = trainHw(m, train, val, {epochs: 4, lr: 0.01})
    expect(r.history.at(-1)!.train).toBeLessThan(r.history[0]!.train)
    expect(logLoss(val, hwPredictor(m))).toBeCloseTo(r.bestVal, 10)
  })

  it('frozen cells (unsupported levels) keep the rule value through training', () => {
    const train = examples.filter((e) => e.person < 32)
    const val = examples.filter((e) => e.person >= 32)
    const m = buildHwModel(false)
    const frozen = unsupportedLevels(train)
    trainHw(m, train, val, {epochs: 2, lr: 0.01, patience: 99, frozen: frozen.map((l) => m.layout.pm + l - 1)})
    for (const l of frozen) expect(m.source[m.layout.pm + l - 1]).toBe(Math.fround([0.7, 0.55, 0.4][l - 1]!))
    expect(frozen).toContain(3) // the Thompson-logged data barely covers level 3
  })

  it('the whole experiment runs end to end on a tiny config', () => {
    const results = runExperiment({settings: [SETTINGS.default!, SETTINGS.enjoyNoise!], seeds: [1], trainPeople: 30, testPeople: 10, valShare: 0.2, train: {epochs: 2}, transferFrom: SETTINGS.default}, () => {})
    expect(results).toHaveLength(2)
    for (const r of results) {
      for (const v of [...Object.values(r.loss), ...Object.values(r.done)]) expect(Number.isFinite(v)).toBe(true)
    }
    expect(results[1]!.loss['hw(from default)']).toBeDefined()
  })
})
