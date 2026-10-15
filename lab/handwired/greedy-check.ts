// Reviewer's check of a confound in learn.ts's policy table (no training, about 10 s):
//   npx tsx lab/handwired/greedy-check.ts
//
// learn.ts's greedyPicker ranks by predicted done share ALONE. The shipped Thompson ranking (rankChallenges) also
// multiplies by levelFit (which demotes off-level and Stretch challenges) and enjoymentFactor, and pins the
// best-proven challenge on top. So "greedy(beta-default) - thompson" mixes two changes: (1) mean instead of a random
// draw, (2) dropping the level/enjoyment/keep-best terms. This script separates them with a "mean" ranking that keeps
// every rankChallenges term except the draw. Same people and seeds as learn.ts's policy table (test split).
// It also counts level-3 examples in the Thompson-logged training split (learn.ts's report: 2 / 0 / 8).
import {pathToFileURL} from 'node:url'
import {DEFAULT_PARAMS, enjoymentFactor, levelFit, posteriorMean, priorFor, suggestTarget} from '../../src/lib/personalize.ts'
import {
  SETTINGS, betaDefault, featuresFor, generateExamples, greedyPicker, policyDoneDays, thompsonPicker, type Features, type Picker,
} from './learn.ts'

const successOf = (c: {done: number, partly: number}) => c.done + 0.5 * c.partly
const failureOf = (c: {skipped: number, partly: number}) => c.skipped + 0.5 * c.partly

/** rankChallenges with the Beta draw replaced by its mean (levelFit, enjoymentFactor and keep-best kept). */
export const meanRankPicker: Picker = (state, _w, level) => {
  const p = DEFAULT_PARAMS
  const rows = featuresFor(state).map((f: Features, i) => {
    const own = f.own
    const prior = priorFor(f.challenge, {fitsBarrier: false, technique: {success: successOf(f.technique), failure: failureOf(f.technique)}}, p)
    const expected = posteriorMean({alpha: prior.alpha + (own ? successOf(own) : 0), beta: prior.beta + (own ? failureOf(own) : 0)})
    const enjoyment = own && own.enjoyN ? own.enjoySum / own.enjoyN : undefined
    const loggedDays = own ? own.done + own.partly + own.skipped : 0
    const proven = !!own && loggedDays >= p.keepBestMinDays && own.done / loggedDays >= p.keepBestRate && (enjoyment ?? 3) > 2
    const record = own && {success: successOf(own), failure: failureOf(own), weeks: own.weeks, doneDays: own.done, loggedDays, enjoyment}
    return {f, i, expected, proven, record, score: expected * levelFit(f.challenge.level, level) * enjoymentFactor(enjoyment)}
  }).sort((a, b) => b.score - a.score || a.i - b.i)
  const best = rows.filter((r) => r.proven).sort((a, b) => b.expected - a.expected)[0]
  const ordered = best ? [best, ...rows.filter((r) => r !== best)] : rows
  return ordered.slice(0, 2).map((r) => ({c: r.f.challenge, target: suggestTarget(r.f.challenge, r.record)}))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const se = (xs: number[]) => Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1) / xs.length)
  for (const setting of Object.values(SETTINGS)) {
    for (const seed of [1, 2, 3]) {
      const t = policyDoneDays(setting, seed, 200, {
        thompson: thompsonPicker(),
        meanRank: meanRankPicker,
        greedy: greedyPicker((f) => betaDefault(f)),
      })
      const d = (a: string, b: string) => {
        const xs = t[a]!.map((x, i) => x - t[b]![i]!)
        return `${mean(xs).toFixed(2)}±${se(xs).toFixed(2)}`
      }
      const lvl3 = setting === SETTINGS.default
        ? `; level-3 examples in train split (people < 240): ${generateExamples(setting, seed, 'train', 300).filter((e) => e.person < 240 && e.f.challenge.level === 3).length}`
        : ''
      console.log(`${setting.name.padEnd(42)} seed ${seed}: thompson ${mean(t.thompson!).toFixed(2)} meanRank ${mean(t.meanRank!).toFixed(2)} greedy ${mean(t.greedy!).toFixed(2)} | meanRank-thompson ${d('meanRank', 'thompson')} greedy-meanRank ${d('greedy', 'meanRank')}${lvl3}`)
    }
  }
}
