// Learning experiment: can a Handwired program, initialized to reproduce personalize.ts's Beta posterior mean,
// learn better "share of opportunity days done" predictions than the Bayesian model it starts from?
//
//   npx tsx lab/handwired/learn.ts            full run: 4 simulator settings x 3 seeds (a few minutes)
//   npx tsx lab/handwired/learn.ts --quick    1 setting, 1 seed, fewer people (smoke run)
//   npx vitest run lab/handwired/learn        fast checks of the plumbing (learn.test.ts)
//
// Everything is simulated: people come from src/lib/simulate.ts's makePerson (or a parameterized copy of it, checked
// equal at the default settings), and their weeks are lived by a copy of simulate()'s week loop (checked equal to
// simulate() for the 'rules' and 'thompson' policies) that also records day-level logs and lets other predictors
// pick challenges. Nothing in src/ is changed.
//
// Predictors compared on held-out people:
//   beta-default  personalize.ts as shipped: priorFor + own record, DEFAULT_PARAMS ("expected" in rankChallenges)
//   beta-tuned    the same Beta formula with priorMean[1..3], priorStrength, techniqueWeight and the weight of a
//                 "tried part of it" day refit on the training people (coordinate search on train log loss)
//   hw            a Handwired program = the Beta formula (prior means in trainable cells) + a ReLU residual net with
//                 zero-initialized output weights, so at init it IS beta-default (checked to FP32 rounding).
//                 Trained with Circuit.backpropagateReference (Handwired's own reverse pass) + Adam, early-stopped
//                 on validation people.
//   hw-ext        the same, plus one feature outside the task's list: the person's record on ALL other challenges.
import {pathToFileURL} from 'node:url'
import {Circuit, type Wire} from './vendor/numeric-ui-core.ts'
import {recommendLevel, suggestChallenges} from '../../src/lib/program.ts'
import {
  DEFAULT_PARAMS, posteriorMean, priorFor, rankChallenges, rng, suggestTarget, type ChallengeRecord, type ModelParams,
} from '../../src/lib/personalize.ts'
import {type SimPerson, type SimResult} from '../../src/lib/simulate.ts'
import {setOutcome} from '../../src/lib/actions.ts'
import {addDays} from '../../src/lib/dates.ts'
import {emptyState} from '../../src/lib/storage.ts'
import {CHALLENGES} from '../../src/data/challenges.ts'
import type {AppState, Challenge, ChallengeLevel, Commitment, WeekPlan} from '../../src/types.ts'

export const TRAIT = 'C' as const
export const POOL: Challenge[] = CHALLENGES.filter((c) => c.trait === TRAIT)

// ── 1. Simulator settings and a parameterized copy of makePerson ────────────────────────────────────────────────────

export interface SimSetting {
  name: string
  techniqueCorrelation: number
  levelEffect: Record<ChallengeLevel, number>
  /** Coefficient of the person's fit in their enjoyment rating (makePerson uses 1.2). */
  enjoyFit: number
}

export const SETTINGS: Record<string, SimSetting> = {
  default: {name: 'default', techniqueCorrelation: 0.6, levelEffect: {1: 0, 2: -0.6, 3: -1.2}, enjoyFit: 1.2},
  tc0: {name: 'tc0 (techniqueCorrelation 0)', techniqueCorrelation: 0, levelEffect: {1: 0, 2: -0.6, 3: -1.2}, enjoyFit: 1.2},
  weakLevel: {name: 'weakLevel (level effect 0/-0.2/-0.4)', techniqueCorrelation: 0.6, levelEffect: {1: 0, 2: -0.2, 3: -0.4}, enjoyFit: 1.2},
  enjoyNoise: {name: 'enjoyNoise (enjoyment unrelated to fit)', techniqueCorrelation: 0.6, levelEffect: {1: 0, 2: -0.6, 3: -1.2}, enjoyFit: 0},
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
function gauss(u: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) * Math.cos(2 * Math.PI * u())
}

/** src/lib/simulate.ts makePerson with its constants as parameters; equal to it at SETTINGS.default (see the test). */
export function makePersonVariant(library: Challenge[], seed: number, s: SimSetting): SimPerson {
  const u = rng(seed)
  const base = 0.6 + 0.8 * gauss(u)
  const p: Record<string, number> = {}
  const enjoy: Record<string, number> = {}
  const techniqueFit = new Map<string, number>()
  for (const c of library) if (!techniqueFit.has(c.technique)) techniqueFit.set(c.technique, gauss(u))
  for (const c of library) {
    const fit = s.techniqueCorrelation * techniqueFit.get(c.technique)! + Math.sqrt(1 - s.techniqueCorrelation ** 2) * gauss(u)
    p[c.id] = sigmoid(base + s.levelEffect[c.level] + 1.0 * fit)
    enjoy[c.id] = Math.min(5, Math.max(1, Math.round(3 + s.enjoyFit * fit + 0.6 * gauss(u))))
  }
  return {p, enjoy, opportunity: 0.7 + 0.25 * u(), missing: 0.05 + 0.2 * u()}
}

// ── 2. Records and features from previous weeks only ───────────────────────────────────────────────────────────────

export interface Counts {done: number, partly: number, skipped: number}
export interface Rec extends Counts {weeks: number, enjoySum: number, enjoyN: number}
const zero = (): Counts => ({done: 0, partly: 0, skipped: 0})
const logged = (c: Counts) => c.done + c.partly + c.skipped
/** Successes with "tried part of it" counted as `q` of a success (personalize.ts uses q = 0.5). */
const successOf = (c: Counts, q = 0.5) => c.done + q * c.partly
const failureOf = (c: Counts, q = 0.5) => c.skipped + (1 - q) * c.partly

export function commitmentCounts(c: Commitment): Counts {
  const outcomes = Object.values(c.log ?? {})
  return {done: c.completions.length, partly: outcomes.filter((o) => o === 'partly').length, skipped: outcomes.filter((o) => o === 'skipped').length}
}

/** Per-challenge record over the given weeks (the same counting as personalize.ts challengeRecords). */
export function records(weeks: readonly WeekPlan[]): Map<string, Rec> {
  const out = new Map<string, Rec>()
  for (const w of weeks) {
    for (const c of w.commitments) {
      const r = out.get(c.challengeId) ?? {done: 0, partly: 0, skipped: 0, weeks: 0, enjoySum: 0, enjoyN: 0}
      const k = commitmentCounts(c)
      r.done += k.done
      r.partly += k.partly
      r.skipped += k.skipped
      r.weeks++
      if (c.enjoyment != null) {
        r.enjoySum += c.enjoyment
        r.enjoyN++
      }
      out.set(c.challengeId, r)
    }
  }
  return out
}

export interface Features {
  challenge: Challenge
  fits: boolean // always false here: simulate() passes no barrier matches and its people have no barrier
  own: Rec | undefined
  /** Record on the other challenges of the same technique (what rankChallenges pools). */
  technique: Counts
  /** Record on all other challenges (hw-ext only). */
  all: Counts
}

/** Features of every pool challenge, from the weeks already in `state` (all of them before the week being planned). */
export function featuresFor(state: AppState, pool: readonly Challenge[] = POOL): Features[] {
  const recs = records(state.weeks)
  const byTech = new Map<string, Counts>()
  const total = zero()
  for (const c of pool) {
    const r = recs.get(c.id)
    if (!r) continue
    const t = byTech.get(c.technique) ?? zero()
    for (const key of ['done', 'partly', 'skipped'] as const) {
      t[key] += r[key]
      total[key] += r[key]
    }
    byTech.set(c.technique, t)
  }
  return pool.map((challenge) => {
    const own = recs.get(challenge.id)
    const t = byTech.get(challenge.technique) ?? zero()
    const minus = (a: Counts): Counts => (own ? {done: a.done - own.done, partly: a.partly - own.partly, skipped: a.skipped - own.skipped} : {...a})
    return {challenge, fits: false, own, technique: minus(t), all: minus(total)}
  })
}

export interface Example {
  f: Features
  /** Opportunity days (done + partly + skipped) and done days, in the week being predicted. */
  n: number
  d: number
  person: number
  week: number
}

// ── 3. Living the weeks: a copy of simulate()'s loop with a pluggable picker and a log hook ─────────────────────────

export type Pick = {c: Challenge, target: number}
export type Picker = (state: AppState, week: number, level: ChallengeLevel, seed: number, person: SimPerson) => Pick[]

export function runPerson(
  person: SimPerson,
  picker: Picker,
  weeks: number,
  seed: number,
  onWeek?: (before: AppState, week: number, commitments: Commitment[]) => void,
  library: Challenge[] = CHALLENGES,
): SimResult {
  const u = rng(seed)
  const start = '2026-01-05'
  let state: AppState = {...emptyState(), startDate: start, goals: [{trait: TRAIT, why: 'sim', vision: 'sim', createdAt: start}]}
  let doneDays = 0, targetDays = 0, met = 0, plans = 0
  for (let w = 0; w < weeks; w++) {
    const prev: WeekPlan | undefined = state.weeks[state.weeks.length - 1]
    const level = recommendLevel(prev, TRAIT, library)
    const picks = picker(state, w, level, seed, person)
    const weekStart = addDays(start, w * 7)
    const commitments: Commitment[] = picks.map(({c, target}) => {
      let commit: Commitment = {challengeId: c.id, ifThen: 'sim', confidence: 7, target, completions: [], log: {}}
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d)
        if (u() < person.missing) continue
        if (u() > person.opportunity) {
          commit = setOutcome(commit, date, 'no-chance')
          continue
        }
        const r = u()
        const pDone = person.p[c.id]!
        commit = setOutcome(commit, date, r < pDone ? 'done' : r < pDone + (1 - pDone) * 0.25 ? 'partly' : 'skipped')
      }
      commit.enjoyment = person.enjoy[c.id]
      return commit
    })
    onWeek?.(state, w, commitments)
    for (const c of commitments) {
      doneDays += c.completions.length
      targetDays += c.target
      met += Math.min(1, c.completions.length / c.target)
      plans++
    }
    state = {...state, weeks: [...state.weeks, {weekIndex: w, startDate: weekStart, commitments}]}
  }
  return {doneDays, targetDays, targetsMet: plans ? met / plans : 0}
}

export const rulesPicker: Picker = (state, _w, level) =>
  suggestChallenges(TRAIT, level, CHALLENGES, state.weeks[state.weeks.length - 1]).slice(0, 2).map((c) => ({c, target: c.perWeek}))

export const thompsonPicker = (params: ModelParams = DEFAULT_PARAMS): Picker => (state, w, level, seed) =>
  rankChallenges(state, {trait: TRAIT, library: CHALLENGES, level, seed: w * 7919 + seed}, params).slice(0, 2).map((s) => ({c: s.challenge, target: s.target}))

/** Top two by a predicted done share; ties keep library order. Target as rankChallenges sets it. */
export const greedyPicker = (predict: (f: Features) => number): Picker => (state) => {
  const feats = featuresFor(state)
  const scored = feats.map((f, i) => ({f, i, score: predict(f)})).sort((a, b) => b.score - a.score || a.i - b.i)
  return scored.slice(0, 2).map(({f}) => ({c: f.challenge, target: suggestTarget(f.challenge, f.own && toChallengeRecord(f.own))}))
}

export const oraclePicker: Picker = (_s, _w, _l, _seed, person) =>
  [...POOL].sort((a, b) => person.p[b.id]! - person.p[a.id]!).slice(0, 2).map((c) => ({c, target: c.perWeek}))

function toChallengeRecord(r: Rec): ChallengeRecord {
  return {success: successOf(r), failure: failureOf(r), weeks: r.weeks, doneDays: r.done, loggedDays: logged(r), enjoyment: r.enjoyN ? r.enjoySum / r.enjoyN : undefined}
}

/** People of one split. Seeds for people and their day noise are disjoint across seeds and splits. */
export function peopleSeeds(seed: number, split: 'train' | 'test', count: number) {
  const offset = split === 'train' ? 0 : 500_000
  return Array.from({length: count}, (_, i) => {
    const personSeed = seed * 1_000_003 + offset + i
    return {personSeed, simSeed: (personSeed * 31 + 17) >>> 0}
  })
}

/** Day-level logs from people living `weeks` weeks under the logging policy (the app's Thompson ranking). */
export function generateExamples(setting: SimSetting, seed: number, split: 'train' | 'test', people: number, weeks = 12, picker: Picker = thompsonPicker()): Example[] {
  const out: Example[] = []
  peopleSeeds(seed, split, people).forEach(({personSeed, simSeed}, person) => {
    const p = makePersonVariant(CHALLENGES, personSeed, setting)
    runPerson(p, picker, weeks, simSeed, (before, week, commitments) => {
      if (week < 1) return // features come from previous weeks only: start at the second week
      const feats = new Map(featuresFor(before).map((f) => [f.challenge.id, f]))
      for (const c of commitments) {
        const k = commitmentCounts(c)
        const n = logged(k)
        if (n === 0) continue
        out.push({f: feats.get(c.challengeId)!, n, d: k.done, person, week})
      }
    })
  })
  return out
}

// ── 4. Baselines ────────────────────────────────────────────────────────────────────────────────────────────────────

/** personalize.ts's expected done share for a challenge (rankChallenges' `expected`). */
export function betaDefault(f: Features, params: ModelParams = DEFAULT_PARAMS): number {
  const prior = priorFor(f.challenge, {fitsBarrier: f.fits, technique: {success: successOf(f.technique), failure: failureOf(f.technique)}}, params)
  const own = f.own ?? zero()
  return posteriorMean({alpha: prior.alpha + successOf(own), beta: prior.beta + failureOf(own)})
}

export interface BetaParams {pm: [number, number, number], k: number, tw: number, q: number}
export const BETA_DEFAULT: BetaParams = {pm: [0.7, 0.55, 0.4], k: 8, tw: 0.5, q: 0.5}

export function betaPredict(f: Features, b: BetaParams): number {
  const m = Math.min(0.95, Math.max(0.05, b.pm[f.challenge.level - 1]!))
  const own = f.own ?? zero()
  const a = b.k * m + b.tw * successOf(f.technique, b.q) + successOf(own, b.q)
  return a / (b.k + b.tw * logged(f.technique) + logged(own))
}

/** Coordinate search over the Beta formula's constants, minimizing training log loss. Levels in `frozenLevels` keep the rule's prior mean. */
export function fitBeta(train: readonly Example[], frozenLevels: readonly ChallengeLevel[] = []): BetaParams {
  let best: BetaParams = {...BETA_DEFAULT, pm: [...BETA_DEFAULT.pm]}
  let bestLoss = logLoss(train, (f) => betaPredict(f, best))
  const grids: [keyof BetaParams | 0 | 1 | 2, number[]][] = [
    [0, range(0.2, 0.95, 0.01)], [1, range(0.1, 0.95, 0.01)], [2, range(0.05, 0.95, 0.01)],
    ['k', [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48]], ['tw', [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5]], ['q', [0, 0.1, 0.2, 0.3, 0.4, 0.5]],
  ]
  for (let round = 0; round < 4; round++) {
    let improved = false
    for (const [key, values] of grids) {
      if (typeof key === 'number' && frozenLevels.includes((key + 1) as ChallengeLevel)) continue
      for (const v of values) {
        const cand: BetaParams = {...best, pm: [...best.pm]}
        if (typeof key === 'number') cand.pm[key] = v
        else (cand as unknown as Record<string, number>)[key] = v
        const loss = logLoss(train, (f) => betaPredict(f, cand))
        if (loss < bestLoss - 1e-12) {
          best = cand
          bestLoss = loss
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return best
}

function range(a: number, b: number, step: number) {
  const out: number[] = []
  for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000)
  return out
}

// ── 5. The Handwired program: Beta formula + zero-initialized ReLU residual ─────────────────────────────────────────

export const HIDDEN = 8
export const P_MIN = 0.001
export const P_MAX = 0.999
const K = DEFAULT_PARAMS.priorStrength
const TW = DEFAULT_PARAMS.techniqueWeight
const sat = (n: number) => n / (n + 7) // 0..1: how much evidence, saturating at about a week of logged days

/** Net features in 0..1 (the level one-hot is read from the rule's cells). */
export function netFeatureNames(extended: boolean) {
  const core = ['ownN', 'ownRate', 'ownDoneRate', 'techN', 'techRate', 'hasEnjoy', 'enjoy01', 'weeks01']
  return extended ? [...core, 'allN', 'allRate'] : core
}

function netFeatures(f: Features, extended: boolean): number[] {
  const own = f.own
  const n = own ? logged(own) : 0
  const tn = logged(f.technique)
  const xs = [
    sat(n),
    n ? successOf(own!) / n : 0,
    n ? own!.done / n : 0,
    sat(tn),
    tn ? successOf(f.technique) / tn : 0,
    own && own.enjoyN ? 1 : 0,
    own && own.enjoyN ? (own.enjoySum / own.enjoyN - 1) / 4 : 0,
    Math.min(12, own?.weeks ?? 0) / 12,
  ]
  if (extended) {
    const an = logged(f.all)
    xs.push(sat(an), an ? successOf(f.all) / an : 0)
  }
  return xs
}

export interface HwModel {
  circuit: Circuit
  pred: Wire
  base: Wire
  extended: boolean
  /** Trainable cells are 0..trainable-1; then the host-written inputs. */
  trainable: number
  layout: {pm: number, bonus: number, w1: number, b1: number, wBase: number, v: number, c0: number, lv: number, fits: number, ownS: number, techS: number, recip: number, x: number}
  featureCount: number
  source: Float32Array
}

export function buildHwModel(extended: boolean, initSeed = 1): HwModel {
  const D = netFeatureNames(extended).length
  const F = D + 3 // + the level one-hot
  // Trainable cells first.
  const pm = 0, bonus = 3, w1 = 4, b1 = w1 + HIDDEN * F, wBase = b1 + HIDDEN, v = wBase + HIDDEN, c0 = v + HIDDEN
  const trainable = c0 + 1
  const lv = trainable, fits = lv + 3, ownS = fits + 1, techS = ownS + 1, recip = techS + 1, x = recip + 1
  const c = new Circuit(x + D)
  const w = (i: number) => c.source(i)
  c.assumeOneHot([w(lv), w(lv + 1), w(lv + 2)])
  c.assumeBit(w(fits))
  c.assumeRange(w(ownS), 0, 1000)
  c.assumeRange(w(techS), 0, 1000)
  c.assumeRange(w(recip), 0, 1)
  for (let i = 0; i < D; i++) c.assumeRange(w(x + i), 0, 1)

  // The rule: posteriorMean(priorFor(...) + own record) with priorMean[1..3] and barrierBonus in cells; the host
  // writes 1/(k + techniqueWeight·technique days + own days), which no trainable cell sits inside.
  const raw = c.roundAffine([
    [c.multiply(w(pm), w(lv)), 1], [c.multiply(w(pm + 1), w(lv + 1)), 1], [c.multiply(w(pm + 2), w(lv + 2)), 1], [c.multiply(w(bonus), w(fits)), 1],
  ])
  const mean = c.roundAffine([[c.reglu([], 1, [[raw, 1]], -0.05), 1], [c.reglu([], 1, [[raw, 1]], -0.95), -1]], 0.05)
  const alpha = c.roundAffine([[mean, K], [w(techS), TW], [w(ownS), 1]])
  const base = c.multiply(w(recip), alpha)

  // Residual: v · relu(W1 · [level one-hot, features] + wBase · base + b1) + c0, output weights start at 0.
  const inputs = [w(lv), w(lv + 1), w(lv + 2), ...Array.from({length: D}, (_, i) => w(x + i))]
  const hidden: Wire[] = []
  for (let j = 0; j < HIDDEN; j++) {
    const terms: [Wire, number][] = [[w(b1 + j), 1], [c.multiply(w(wBase + j), base), 1]]
    inputs.forEach((input, i) => terms.push([c.multiply(w(w1 + j * F + i), input), 1]))
    hidden.push(c.reglu([], 1, [[c.roundAffine(terms), 1]], 0))
  }
  const out = c.roundAffine([[w(c0), 1], ...hidden.map((h, j) => [c.multiply(w(v + j), h), 1] as const)])
  const predRaw = c.roundAffine([[base, 1], [out, 1]])
  const pred = c.roundAffine([[c.reglu([], 1, [[predRaw, 1]], -P_MIN), 1], [c.reglu([], 1, [[predRaw, 1]], -P_MAX), -1]], P_MIN)

  const source = new Float32Array(c.sourceSize)
  source.set([0.7, 0.55, 0.4, DEFAULT_PARAMS.barrierBonus])
  const u = rng(initSeed)
  const scale = Math.sqrt(6 / (F + 1 + 1))
  for (let i = 0; i < HIDDEN * F; i++) source[w1 + i] = (2 * u() - 1) * scale
  for (let j = 0; j < HIDDEN; j++) {
    source[b1 + j] = 0.1
    source[wBase + j] = (2 * u() - 1) * scale
    source[v + j] = 0 // zero output weights: the program starts as the rule
  }
  source[c0] = 0
  return {circuit: c, pred, base, extended, trainable, layout: {pm, bonus, w1, b1, wBase, v, c0, lv, fits, ownS, techS, recip, x}, featureCount: D, source}
}

/** Write one example's inputs (everything after the trainable cells). */
export function writeInputs(m: HwModel, f: Features, source: Float32Array = m.source) {
  const L = m.layout
  source.fill(0, L.lv)
  source[L.lv + f.challenge.level - 1] = 1
  source[L.fits] = f.fits ? 1 : 0
  const own = f.own ?? zero()
  source[L.ownS] = successOf(own)
  source[L.techS] = successOf(f.technique)
  source[L.recip] = 1 / (K + TW * logged(f.technique) + logged(own))
  netFeatures(f, m.extended).forEach((value, i) => (source[L.x + i] = value))
  return source
}

/** A fast predictor over the model's current cells (compiled evaluator; checks source ranges only). */
export function hwPredictor(m: HwModel): (f: Features) => number {
  const run = m.circuit.createTensorEvaluator([m.pred])
  const source = Float32Array.from(m.source)
  return (f) => run(writeInputs(m, f, source))[0]!
}

export interface TrainOptions {epochs?: number, batch?: number, lr?: number, decay?: number, patience?: number, seed?: number, log?: (s: string) => void, frozen?: readonly number[]}

/** Levels with fewer than `minDays` training days: their prior mean has no real support in the logs. */
export function unsupportedLevels(train: readonly Example[], minDays = 200): ChallengeLevel[] {
  return ([1, 2, 3] as const).filter((l) => train.filter((e) => e.f.challenge.level === l).reduce((s, e) => s + e.n, 0) < minDays)
}

/** Gradient of the mean day-level log loss over `batch` w.r.t. every trainable cell, via Handwired's reverse pass. */
export function batchGradient(m: HwModel, batch: readonly Example[]): {grad: Float64Array, loss: number} {
  const grad = new Float64Array(m.trainable)
  const days = batch.reduce((s, e) => s + e.n, 0)
  let loss = 0
  const outputGradients = new Float32Array(m.circuit.sourceSize + m.circuit.operations.length)
  for (const e of batch) {
    writeInputs(m, e.f)
    const values = m.circuit.evaluateReference(m.source)
    const p = values[m.pred]!
    loss -= e.d * Math.log(p) + (e.n - e.d) * Math.log(1 - p)
    outputGradients[m.pred] = (e.n * p - e.d) / (p * (1 - p)) / days // d(mean BCE)/dp
    const g = m.circuit.backpropagateReference(values, outputGradients)
    for (let i = 0; i < m.trainable; i++) grad[i]! += g[i]!
  }
  return {grad, loss: loss / days}
}

/** Minibatch Adam on the trainable cells, written back into the source table with Math.fround; best validation epoch kept. */
export function trainHw(m: HwModel, train: readonly Example[], val: readonly Example[], o: TrainOptions = {}) {
  // Defaults chosen on validation people only (setting default, seed 1): lr 0.003 vs 0.01/0.03, decay 1e-4 vs 1e-2.
  const {epochs = 40, batch = 128, lr = 0.003, decay = 1e-4, patience = 8, seed = 1, log, frozen = []} = o
  const isFrozen = new Uint8Array(m.trainable)
  for (const p of frozen) isFrozen[p] = 1
  const first = new Float64Array(m.trainable)
  const second = new Float64Array(m.trainable)
  const u = rng(seed)
  const order = train.map((_, i) => i)
  const valLoss = () => logLoss(val, hwPredictor(m))
  let best = {loss: valLoss(), epoch: 0, cells: m.source.slice(0, m.trainable)}
  const history = [{epoch: 0, train: logLoss(train, hwPredictor(m)), val: best.loss}]
  let step = 0
  for (let epoch = 1; epoch <= epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(u() * (i + 1))
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    for (let start = 0; start < order.length; start += batch) {
      const {grad} = batchGradient(m, order.slice(start, start + batch).map((i) => train[i]!))
      step++
      for (let p = 0; p < m.trainable; p++) {
        if (isFrozen[p]) continue
        const isWeight = p >= m.layout.w1 && p < m.layout.b1 || p >= m.layout.wBase && p < m.layout.c0
        const g = grad[p]! + (isWeight ? decay * m.source[p]! : 0)
        first[p] = 0.9 * first[p]! + 0.1 * g
        second[p] = 0.999 * second[p]! + 0.001 * g * g
        const delta = (lr * first[p]! / (1 - 0.9 ** step)) / (Math.sqrt(second[p]! / (1 - 0.999 ** step)) + 1e-8)
        m.source[p] = Math.fround(m.source[p]! - delta)
      }
    }
    const v = valLoss()
    history.push({epoch, train: logLoss(train, hwPredictor(m)), val: v})
    log?.(`    epoch ${epoch}: train ${history.at(-1)!.train.toFixed(5)} val ${v.toFixed(5)}`)
    if (v < best.loss) best = {loss: v, epoch, cells: m.source.slice(0, m.trainable)}
    else if (epoch - best.epoch >= patience) break
  }
  m.source.set(best.cells)
  return {bestEpoch: best.epoch, bestVal: best.loss, history}
}

// ── 6. Metrics ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Mean binary cross-entropy per opportunity day (done = 1; partly and skipped = 0). */
export function logLoss(ex: readonly Example[], predict: (f: Features) => number): number {
  let loss = 0, days = 0
  for (const e of ex) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, predict(e.f)))
    loss -= e.d * Math.log(p) + (e.n - e.d) * Math.log(1 - p)
    days += e.n
  }
  return loss / days
}

/** Expected calibration error over 10 equal-width bins (weighted by days), mean prediction vs mean observed, Brier. */
export function calibration(ex: readonly Example[], predict: (f: Features) => number) {
  const bins = Array.from({length: 10}, () => ({days: 0, pred: 0, done: 0}))
  let days = 0, pred = 0, done = 0, brier = 0
  for (const e of ex) {
    const p = predict(e.f)
    const b = bins[Math.min(9, Math.floor(p * 10))]!
    b.days += e.n
    b.pred += p * e.n
    b.done += e.d
    days += e.n
    pred += p * e.n
    done += e.d
    brier += e.d * (1 - p) ** 2 + (e.n - e.d) * p ** 2
  }
  const ece = bins.reduce((s, b) => s + (b.days ? (b.days / days) * Math.abs(b.pred / b.days - b.done / b.days) : 0), 0)
  return {ece, meanPred: pred / days, meanObs: done / days, brier: brier / days, bins: bins.map((b, i) => ({bin: `${i / 10}-${(i + 1) / 10}`, days: b.days, pred: b.days ? b.pred / b.days : NaN, obs: b.days ? b.done / b.days : NaN}))}
}

/**
 * Done days per person over `weeks` weeks; every policy sees the same people and the same day-noise seed. (Reviewer's
 * note: the day stream is shared only until two policies' picks differ; how many draws a day consumes depends on its
 * outcome, so the streams then drift apart. The pairing reduces variance but is not "the same random draws" throughout.)
 */
export function policyDoneDays(setting: SimSetting, seed: number, people: number, pickers: Record<string, Picker>, weeks = 12) {
  const totals: Record<string, number[]> = Object.fromEntries(Object.keys(pickers).map((k) => [k, []]))
  for (const {personSeed, simSeed} of peopleSeeds(seed, 'test', people)) {
    const person = makePersonVariant(CHALLENGES, personSeed, setting)
    for (const [name, picker] of Object.entries(pickers)) totals[name]!.push(runPerson(person, picker, weeks, simSeed).doneDays)
  }
  return totals
}

// ── 7. The experiment ───────────────────────────────────────────────────────────────────────────────────────────────

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: readonly number[]) => (xs.length < 2 ? 0 : Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1)))
const fmt = (xs: readonly number[], digits = 4) => `${mean(xs).toFixed(digits)} ± ${sd(xs).toFixed(digits)}`

export interface RunConfig {settings: SimSetting[], seeds: number[], trainPeople: number, testPeople: number, valShare: number, train: TrainOptions, transferFrom?: SimSetting}

export function runExperiment(cfg: RunConfig, log: (s: string) => void = console.log) {
  type Row = Record<string, number>
  const results: {setting: string, seed: number, loss: Row, ece: Row, meanPred: Row, brier: Row, done: Row, diffs: Row, extra: Record<string, unknown>}[] = []
  const transferModels = new Map<number, {hw: HwModel, hwGated: HwModel, beta: BetaParams}>() // by seed, trained on cfg.transferFrom
  const settings = cfg.transferFrom ? [cfg.transferFrom, ...cfg.settings.filter((s) => s !== cfg.transferFrom)] : cfg.settings
  for (const setting of settings) {
    for (const seed of cfg.seeds) {
      const t0 = performance.now()
      const all = generateExamples(setting, seed, 'train', cfg.trainPeople)
      const valCut = Math.floor(cfg.trainPeople * (1 - cfg.valShare))
      const train = all.filter((e) => e.person < valCut)
      const val = all.filter((e) => e.person >= valCut)
      const test = generateExamples(setting, seed, 'test', cfg.testPeople)
      const tuned = fitBeta(train)
      const hw = buildHwModel(false, seed)
      const fitHw = trainHw(hw, train, val, {...cfg.train, seed})
      const hwExt = buildHwModel(true, seed)
      const fitExt = trainHw(hwExt, train, val, {...cfg.train, seed})
      // Post-hoc variant (added after seeing greedy picks of level-3 challenges whose prior was fit to 0-8 examples):
      // keep the rule's prior mean for levels the logs barely cover.
      const frozenLevels = unsupportedLevels(train)
      const tunedGated = fitBeta(train, frozenLevels)
      const hwGated = buildHwModel(false, seed)
      const fitGated = trainHw(hwGated, train, val, {...cfg.train, seed, frozen: frozenLevels.map((l) => hwGated.layout.pm + l - 1)})
      if (setting === cfg.transferFrom) transferModels.set(seed, {hw, hwGated, beta: tuned})
      const trainMean = train.reduce((s, e) => s + e.d, 0) / train.reduce((s, e) => s + e.n, 0)

      const predictors: Record<string, (f: Features) => number> = {
        constant: () => trainMean,
        'beta-default': (f) => betaDefault(f),
        'beta-tuned': (f) => betaPredict(f, tuned),
        hw: hwPredictor(hw),
        'hw-ext': hwPredictor(hwExt),
        'beta-tuned-gated': (f) => betaPredict(f, tunedGated),
        'hw-gated': hwPredictor(hwGated),
      }
      const transfer = transferModels.get(seed)
      if (transfer && setting !== cfg.transferFrom) {
        predictors['beta-tuned(from default)'] = (f) => betaPredict(f, transfer.beta)
        predictors['hw(from default)'] = hwPredictor(transfer.hw)
        predictors['hw-gated(from default)'] = hwPredictor(transfer.hwGated)
      }
      const loss: Row = {}, ece: Row = {}, meanPred: Row = {}, brier: Row = {}
      for (const [name, p] of Object.entries(predictors)) {
        loss[name] = logLoss(test, p)
        const cal = calibration(test, p)
        ece[name] = cal.ece
        meanPred[name] = cal.meanPred
        brier[name] = cal.brier
      }
      const observed = calibration(test, predictors.constant!).meanObs
      meanPred.observed = observed

      const pickers: Record<string, Picker> = {
        rules: rulesPicker,
        'thompson(beta-default)': thompsonPicker(),
        'greedy(beta-default)': greedyPicker(predictors['beta-default']!),
        'greedy(beta-tuned)': greedyPicker(predictors['beta-tuned']!),
        'greedy(hw)': greedyPicker(predictors.hw!),
        'greedy(hw-ext)': greedyPicker(predictors['hw-ext']!),
        'greedy(beta-tuned-gated)': greedyPicker(predictors['beta-tuned-gated']!),
        'greedy(hw-gated)': greedyPicker(predictors['hw-gated']!),
        oracle: oraclePicker,
      }
      if (transfer && setting !== cfg.transferFrom) {
        pickers['greedy(hw from default)'] = greedyPicker(predictors['hw(from default)']!)
        pickers['greedy(hw-gated from default)'] = greedyPicker(predictors['hw-gated(from default)']!)
      }
      const doneRaw = policyDoneDays(setting, seed, cfg.testPeople, pickers)
      const done: Row = Object.fromEntries(Object.entries(doneRaw).map(([k, xs]) => [k, mean(xs)]))
      // Paired per-person differences (same people, same day noise) and their standard errors.
      const paired = (a: string, b: string) => {
        const d = doneRaw[a]!.map((x, i) => x - doneRaw[b]![i]!)
        return {mean: mean(d), se: sd(d) / Math.sqrt(d.length)}
      }
      const diffs: Row = {}
      for (const [a, b] of [['greedy(hw)', 'greedy(beta-default)'], ['greedy(hw)', 'greedy(beta-tuned)'], ['greedy(hw)', 'thompson(beta-default)'], ['greedy(hw-ext)', 'greedy(beta-tuned)'], ['greedy(beta-default)', 'thompson(beta-default)'],
        ['greedy(hw-gated)', 'greedy(beta-default)'], ['greedy(hw-gated)', 'greedy(beta-tuned-gated)'], ['greedy(hw-gated)', 'thompson(beta-default)']] as const) {
        const p = paired(a, b)
        diffs[`${a} - ${b}`] = p.mean
        diffs[`${a} - ${b} (se)`] = p.se
      }
      const ms = performance.now() - t0
      results.push({setting: setting.name, seed, loss, ece, meanPred, brier, done, diffs, extra: {
        trainExamples: train.length, valExamples: val.length, testExamples: test.length,
        trainDays: train.reduce((s, e) => s + e.n, 0), testDays: test.reduce((s, e) => s + e.n, 0),
        tuned, tunedGated, frozenLevels, hwGatedBestEpoch: fitGated.bestEpoch, hwBestEpoch: fitHw.bestEpoch, hwExtBestEpoch: fitExt.bestEpoch, hwPriorMeans: Array.from(hw.source.slice(0, 3)),
        calibrationBins: seed === cfg.seeds[0] ? Object.fromEntries(['beta-default', 'beta-tuned', 'hw'].map((k) => [k, calibration(test, predictors[k]!).bins])) : undefined,
        ms,
      }})
      log(`[${setting.name} seed ${seed}] ${train.length}/${val.length}/${test.length} train/val/test examples; hw best epoch ${fitHw.bestEpoch}, hw-ext ${fitExt.bestEpoch}; ${(ms / 1000).toFixed(1)} s`)
    }
  }
  return results
}

export function printReport(results: ReturnType<typeof runExperiment>, log: (s: string) => void = console.log) {
  const settings = [...new Set(results.map((r) => r.setting))]
  for (const s of settings) {
    const rs = results.filter((r) => r.setting === s)
    log(`\n=== ${s}: ${rs.length} seed(s) [${rs.map((r) => r.seed).join(', ')}]; mean ± sd across seeds ===`)
    log(`test examples per seed: ${rs.map((r) => r.extra.testExamples).join(', ')} (days: ${rs.map((r) => r.extra.testDays).join(', ')})`)
    log('predictor                    log loss            ECE                 Brier               mean pred (observed ' + fmt(rs.map((r) => r.meanPred.observed!)) + ')')
    for (const k of Object.keys(rs[0]!.loss)) {
      log(`  ${k.padEnd(26)} ${fmt(rs.map((r) => r.loss[k]!))}   ${fmt(rs.map((r) => r.ece[k]!))}   ${fmt(rs.map((r) => r.brier[k]!))}   ${fmt(rs.map((r) => r.meanPred[k]!))}`)
    }
    log(`log loss per seed: ${Object.keys(rs[0]!.loss).map((k) => `${k} ${rs.map((r) => r.loss[k]!.toFixed(4)).join('/')}`).join('; ')}`)
    log('policy (done days per person, 12 weeks)')
    for (const k of Object.keys(rs[0]!.done)) log(`  ${k.padEnd(26)} ${fmt(rs.map((r) => r.done[k]!), 2)}`)
    log('paired differences (per seed: mean ± se over people)')
    for (const k of Object.keys(rs[0]!.diffs).filter((k) => !k.endsWith('(se)'))) {
      log(`  ${k.padEnd(50)} ${rs.map((r) => `${r.diffs[k]!.toFixed(2)}±${r.diffs[`${k} (se)`]!.toFixed(2)}`).join('  ')}   mean ${mean(rs.map((r) => r.diffs[k]!)).toFixed(2)}`)
    }
    log(`beta-tuned params per seed: ${rs.map((r) => JSON.stringify(r.extra.tuned)).join(' ')}`)
    log(`levels with < 200 training days (frozen in *-gated) per seed: ${rs.map((r) => JSON.stringify(r.extra.frozenLevels)).join(' ')}`)
    log(`hw learned priorMean per seed: ${rs.map((r) => (r.extra.hwPriorMeans as number[]).map((v) => v.toFixed(3)).join('/')).join(' ')}`)
    const bins = rs[0]!.extra.calibrationBins as Record<string, {bin: string, days: number, pred: number, obs: number}[]> | undefined
    if (bins) {
      log(`calibration bins, seed ${rs[0]!.seed} (bin: days pred/obs)`)
      for (const [k, bs] of Object.entries(bins)) log(`  ${k.padEnd(13)} ${bs.filter((b) => b.days).map((b) => `${b.bin}: ${b.days} ${b.pred.toFixed(2)}/${b.obs.toFixed(2)}`).join(' | ')}`)
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const quick = process.argv.includes('--quick')
  const t0 = performance.now()
  const cfg: RunConfig = quick
    ? {settings: [SETTINGS.default!], seeds: [1], trainPeople: 120, testPeople: 80, valShare: 0.2, train: {epochs: 15}}
    : {settings: Object.values(SETTINGS), seeds: [1, 2, 3], trainPeople: 300, testPeople: 200, valShare: 0.2, train: {}, transferFrom: SETTINGS.default}
  const m = buildHwModel(false)
  const mx = buildHwModel(true)
  const ops = (mm: HwModel) => {
    const prog = mm.circuit.compileTensorProgram([mm.pred])
    return `${mm.circuit.sourceSize} cells (${mm.trainable} trainable), ${mm.circuit.operations.length} built ops, ${prog.valueCount - prog.sourceSize} live, ${prog.layers.length} layers`
  }
  console.log(`Node ${process.version}; hw: ${ops(m)}; hw-ext: ${ops(mx)}`)
  console.log(`config: ${JSON.stringify({...cfg, settings: cfg.settings.map((s) => s.name), transferFrom: cfg.transferFrom?.name})}`)
  const results = runExperiment(cfg)
  printReport(results)
  console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(1)} s`)
}
