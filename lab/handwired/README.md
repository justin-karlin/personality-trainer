# Handwired lab: an exact `recommendLevel` and a trained done-share predictor

This folder tries [Handwired](https://github.com/chenglou/handwired) (fixed FP32 programs built from affine, ReLU,
boolean and table-read operations) on two pieces of the app:

1. **Exactness.** `recommendLevel` from `src/lib/program.ts`, rebuilt as a Handwired program and checked against the
   real function.
2. **Learning.** A Handwired program that starts out as the Beta posterior mean from `src/lib/personalize.ts` and is then
   trained on simulated logs. It is compared with the shipped Beta model and with a refit Beta model, first as a
   predictor and then as a ranking policy.

Nothing outside `lab/handwired/` is changed. The lab is not part of the app build; its tests run with the app's `npm test`.

## Files

| File | What it is |
|---|---|
| `vendor/numeric-ui-core.ts`, `vendor/cells.ts`, `vendor/LICENSE` | Handwired runtime, vendored unmodified from commit `4ea7fcb27ebe93acf49b9f29a93e162b975bad46` (MIT). A header comment names the source. The bodies are byte-identical to upstream apart from a blank separator line. |
| `recommend-level.ts` / `.test.ts` | The `recommendLevel` program, its host preprocessing (`weekToInputs`), its evaluators, size and timings, and the comparison tests. |
| `learn.ts` / `.test.ts` | Learning experiment: simulator adapter, Beta baselines, the Handwired predictor, training, metrics and policy runs. |
| `greedy-check.ts` | Added in review. Splits the "greedy vs Thompson" gain into two parts, with no training (see Results). |
| `NOTES-api.md`, `NOTES-training.md`, `notes-*-check.ts`, `notes-*.test.ts` | Handwired API and training notes. The claims marked [checked] are asserted by the check scripts. |
| `tsconfig.json` | Type-checks the lab. The app's tsconfig covers only `src/`. |

## How to run

From the repository root (Node 22):

```
npx vitest run lab/handwired                   # all lab tests, about 3 s
npx tsc -p lab/handwired                       # type-check
npx tsx lab/handwired/recommend-level.ts       # program size and timings
npx tsx lab/handwired/learn.ts --quick         # 1 setting, 1 seed, about 4 s
npx tsx lab/handwired/learn.ts                 # full run: 4 settings x 3 seeds, about 3.5 min
npx tsx lab/handwired/greedy-check.ts          # policy decomposition, about 6 s
```

## Part 1: `recommendLevel` as a Handwired program

**How the work is split**
- **Host (plain JS) computes five inputs:**
  - whether last week had a commitment for the trait;
  - the average level, rounded with `Math.round` and clamped to 1..3;
  - `completionRate` in float64;
  - whether there are any ratings;
  - the mean enjoyment.
- **The program makes the decisions:**
  - three exact sign-cascade comparisons: rate < 0.5, rate ≥ 0.8 and mean ≤ 2;
  - one comparison on the integer grid: avgLevel ≤ 1;
  - integer ReLU logic that combines them.
- **The program is not the whole function.** The filtering, averaging, rounding and clamping are host JS that copies the
  real function's lines.

**FP32 handling**
- The float64 rate is rounded to FP32 once, when it is written to the source table. The program compares it with `f(T)`.
- Rounding preserves order, so values exactly on a threshold (4/5, 1/2, a mean of 2) compare the same way as in JS.
- A flip is possible only for values within half an FP32 step of a threshold. Real inputs need millions of target days
  or ratings before any value can land there.

**Reproduced results** (Node v22.22.2, this review):

| Check | Result |
|---|---|
| (a) Grid: rates k/n for n = 1..14, levels 1–3, enjoyment absent or 1..5 in steps of 0.25, all 5 traits, plus "no previous week" cases. Each case is a real WeekPlan compared with `recommendLevel`. | 32,145 cases, 0 mismatches. 0 cases where `weekToInputs` did not give back the grid point. 0 mismatches between the reference and tensor evaluators. |
| (b) Random WeekPlans from `CHALLENGES`, including unknown ids, other traits, over-target completions and mixed levels | 30,000 cases, 0 mismatches. Each branch was hit at least 427 times. |
| (c) The k (or rating sum) next to each threshold, for every n up to 100,000 | 699,994 values, 0 flips |
| `has = 0` gating; exact-threshold rates (1/2, 4/5, 8/10, 12/15, 20/25, 44/55) and a mean of exactly 2 | pass |
| Program size | 5 source cells, 56 built / 52 live operations, 17 layers, 78 weights + 52 biases (46 of the rounding points are sign-cascade steps) |

**Timing** (`npx tsx lab/handwired/recommend-level.ts`, one run on a quiet machine):

| Call | Time per call |
|---|---|
| `evaluate` (validates every input) | 1.85 µs |
| `evaluateFast` (compiled) | 0.96 µs |
| `evaluateReference` | 4.69 µs |
| `recommendLevelViaProgram` (preprocessing + `evaluate`) | 1.83 µs |
| plain `recommendLevel` | 0.21 µs |

The program path is about 9× slower than the plain function. It is still about 2 µs per call.

**Mutation check (this review).** I changed one line at a time and re-ran the recommend-level tests.

| Change | Result |
|---|---|
| `Math.round` → `Math.floor` in `weekToInputs` | 1 test failed |
| stepUp bias −2 → −1.5 | 4 tests failed |
| `hasRatings` dropped from `disliked` | 3 tests failed |
| Mean threshold 2 → 2.0000003 | passed |
| Rate threshold 0.5 → 0.49999997 | passed |

The two that passed are equivalent to the original on any realistic input. Each moves a threshold by one FP32 step, and
only data with more than about 4–16 million days or ratings could tell them apart. That is the same argument the design
relies on, so these are not test gaps.

**Domain caveat (found in review)**
- The exactness holds for integer enjoyment ratings 1..5, which is what the Reflect UI writes.
- A stored rating outside 0..5 makes the evaluator throw, while the JS function still returns a level. `parseState` does
  not validate `enjoyment`.
- A non-integer mean just above 2 (for example 2.0000001) gives level 1 from the program and 2 from JS.
- A test now documents both behaviours.

## Part 2: can a trained Handwired predictor beat the Beta model?

**Setup** (taken from the code, which I checked line by line)
- **People.** Simulated people from a parameterized copy of `makePerson`. A test checks it equals the original at the
  default settings and at tc0.
- **Weeks.** Each person lives 12 weeks under the shipped Thompson ranking. This uses a copy of `simulate()`'s loop, and a
  test checks it equals `simulate()` for both the 'rules' and the 'thompson' policies.
- **Examples.** One per planned challenge from week 2 on. The target is done ÷ (done + partly + skipped) days in that
  week. Features come only from earlier weeks (tested).
- **Split.** 240 training and 60 validation people for each seed, plus 200 test people from a disjoint seed range.
- **Predictors:**
  - **beta-default:** `priorFor` with `DEFAULT_PARAMS`. A test checks it is equal (`toBe`) to `rankChallenges`' `expected`.
  - **beta-tuned:** prior means, prior strength, technique weight and partly-day weight refit by coordinate search on
    training log loss.
  - **hw:** the Beta formula, with its prior means in trainable cells, plus an 8-unit ReLU residual whose output starts at
    zero. At the start it equals beta-default to within 2e-7. It is trained with Handwired's `backpropagateReference`;
    a test checks those gradients against central differences. Optimizer: Adam, with early stopping on the validation
    people.
  - **hw-ext:** hw plus the person's record on all other challenges.
  - **\*-gated:** the prior mean is held at the rule's value for any level with fewer than 200 training days, which was
    level 3 in every seed. **This gating was added after the authors saw test results.**

**Reproduced results.** Run with `npx tsx lab/handwired/learn.ts` (215 s). Every number below matches the authors' report
to the printed digits. The output is deterministic.

### Prediction (test people, log loss per opportunity day, mean ± sd over seeds 1–3)

| Setting | constant | beta-default | beta-tuned | hw | hw-ext |
|---|---|---|---|---|---|
| default | 0.6043 | 0.5486 ± 0.0095 | 0.5380 ± 0.0082 | 0.5355 ± 0.0085 | 0.5301 ± 0.0074 |
| tc0 (techniqueCorrelation 0) | 0.6088 | 0.5555 | 0.5425 | 0.5402 | 0.5332 |
| weakLevel (level effect 0/−0.2/−0.4) | 0.5823 | 0.5326 | 0.5236 | 0.5216 | 0.5153 |
| enjoyNoise (enjoyment unrelated to fit) | 0.6297 | 0.5760 | 0.5610 | 0.5612 | 0.5553 |

**Default setting, more measures**
- **Calibration error (ECE):** beta-default 0.042, beta-tuned 0.009, hw 0.014, hw-ext 0.015.
- **Mean prediction:** beta-default 0.740, beta-tuned 0.702, hw 0.697, hw-ext 0.703. The observed share is 0.7075.

**Paired gaps per seed (seeds 1 / 2 / 3)**

| Comparison | default | tc0 | weakLevel | enjoyNoise |
|---|---|---|---|---|
| hw − beta-tuned | −0.0025 / −0.0033 / −0.0019 | −0.0023 / −0.0034 / −0.0015 | −0.0019 / −0.0024 / −0.0016 | −0.0004 / +0.0005 / +0.0005 |
| hw-ext − beta-tuned | −0.0071 / −0.0077 / −0.0088 | −0.0110 / −0.0089 / −0.0083 | −0.0083 / −0.0078 / −0.0087 | −0.0064 / −0.0065 / −0.0044 |
| beta-tuned − beta-default | −0.0094 / −0.0105 / −0.0118 | | | |

**Beta-tuned constants**
- Prior strength k = 3 in 11 of 12 fits. The exception is enjoyNoise seed 2, which picked k = 4. The app ships k = 8.
- A partly day is counted as 0–0.2 of a success. The app uses 0.5.
- The level-3 prior mean landed anywhere from 0.05 to 0.95, depending on the seed.

**Transfer (trained on default, tested on enjoyNoise)**

| | Log loss (seeds 1 / 2 / 3) | ECE |
|---|---|---|
| hw | 0.5616 / 0.5673 / 0.5696 | 0.027 |
| beta-tuned | 0.5576 / 0.5590 / 0.5658 | 0.009 |

### Policy (done days per person over 12 weeks, test people, mean over 3 seeds)

| Setting | rules | thompson (shipped) | greedy beta-default | greedy hw | greedy hw-gated | oracle |
|---|---|---|---|---|---|---|
| default | 71.1 | 82.1 | 84.2 | 80.9 ± 7.8 | 85.1 | 97.0 |
| tc0 | 71.5 | 81.5 | 83.7 | 84.9 | 84.9 | 97.7 |
| weakLevel | 74.3 | 84.6 | 84.8 | 82.4 ± 4.6 | 84.8 | 99.6 |
| enjoyNoise | 65.7 | 78.7 | 84.2 | 81.9 ± 4.2 | 84.2 | 97.0 |

**greedy hw-gated − greedy beta-default**, mean over seeds:

| Setting | Mean | Per seed |
|---|---|---|
| default | +0.86 | +0.89 / +1.69 / +0.01 |
| tc0 | +1.15 | |
| weakLevel | −0.07 | |
| enjoyNoise | −0.09 | |

**Ungated models fail in some seeds.**
- Greedy hw scored −11.93 against greedy beta-default in default seed 1.
- Greedy hw-ext averaged 78.5 ± 11.0 in the default setting.
- The cause: the Thompson logs contain only 2 / 0 / 8 level-3 examples in seeds 1–3 (re-counted in `greedy-check.ts`). The
  learned level-3 prior is therefore arbitrary, and greedy ranking acts on it.

### Splitting the "greedy" gain (new in review: `greedy-check.ts`)

`greedyPicker` changes two things relative to the shipped `rankChallenges`:
1. **Mean instead of a draw.** It ranks by the posterior mean rather than a Thompson draw.
2. **Dropped terms.** It leaves out `levelFit`, `enjoymentFactor` and the keep-best pin.

The "meanRank" policy makes change 1 only: it keeps every `rankChallenges` term and replaces the draw with its mean.
Paired differences in done days per person, seeds 1 / 2 / 3 (± standard error over 200 people):

| Setting | meanRank − thompson | greedy − meanRank |
|---|---|---|
| default | +1.39 / +2.12 / +1.39 | +0.34 / −0.03 / +1.26 |
| tc0 | +2.23 / +1.99 / +1.25 | +0.78 / −0.34 / +0.67 |
| weakLevel | +0.92 / +0.97 / +0.94 | −1.15 / −0.86 / −0.18 |
| enjoyNoise | +1.40 / +1.04 / +2.10 | +4.21 / +4.15 / +3.66 |

(± is about 0.4–0.6 throughout.)

- **Taking the mean instead of a draw** is worth about +1 to +2 done days in every setting.
- **The large enjoyNoise gain (+5.5)** comes mostly from dropping `enjoymentFactor`. When ratings are noise, that factor
  demotes good challenges.
- **In weakLevel**, dropping `levelFit` costs about 0.7 days.

## Review: discrepancies and caveats

**Exactness claim: holds.** The tests compare against the real `src/lib/program.ts` function on the claimed input sets,
including threshold-exact values, and I reproduced every count. Qualifications:
- The domain is limited to integer ratings in 1..5 (see Part 1).
- Host JS does about half the work: filtering, averaging, `Math.round` and the clamp.
- I measured about 9× slower than the plain function (the authors reported 8×).

**Learning comparison: mostly fair, with these qualifications**
- **No leakage found.** Training, validation and test people are disjoint. Features use only earlier weeks. Gating and
  tuned constants come from training data only.
- **One choice was made after looking at test results.** The hw-gated fix and the 200-day cutoff were chosen after the
  authors saw the seed-1 test result, and they disclose this.
- **hw has a small model-selection advantage.** It uses the 60 validation people for early stopping, while beta-tuned
  never sees them. The learning rate and weight decay "chosen on validation" have no script in the folder, so I could not
  verify that claim.
- **The baseline is implemented as in `personalize.ts`.** A test checks it equals `rankChallenges`' `expected` exactly.
  It is scored on a done-only target that the shipped model was not built for, since it counts a partly day as half a
  success. beta-tuned removes that disadvantage, so it is the fair comparison.
- **The four settings are not independent replications.** They reuse the same person seeds, so they are the same
  individuals with different constants.
- **"Same random draws for every policy" is too strong.** The policies share the day-noise seed, but the streams drift
  apart once their picks differ. I corrected the comment in `learn.ts`.

**Numerical discrepancies in the authors' reports (all minor)**
- The report says hw-ext's edge over beta-tuned is "−0.004 to −0.009". The measured range is −0.0044 to −0.0110; tc0
  seed 1 is −0.0110.
- The report says the search "always picked k = 3". enjoyNoise seed 2 picked k = 4.
- The report attributes the gain over Thompson to "ranking greedily, whatever the predictor". `greedy-check.ts` shows it
  combines two effects: the mean instead of the draw (+1 to +2 days) and dropping `levelFit` and `enjoymentFactor`. The
  second accounts for most of the enjoyNoise gain and is negative in weakLevel.
- The exactness timings are about 10% slower in their run than in mine, which is normal run-to-run variation.

## What this shows

1. **Handwired can express the app's level rule exactly**, given careful FP32 handling. That is a property of the tool,
   not a product gain: the program is slower and no more capable than the JS function.
2. **On simulated data, the trained Handwired predictor beats the refit Beta model by 0.002–0.003 log loss per day.**
   The gain disappears when enjoyment carries no signal, and it transfers worse than the Beta model. **It is learning the
   simulator's enjoyment assumption, not something general.**
3. **Recalibrating the Beta model gives most of the gain (0.009–0.012)**, with no network. The changes are prior strength
   about 3, a partly day counted as about 0–0.2 of a success, and lower prior means. **These values come from our own
   simulator, so they must not be shipped without real logs.**
4. **Pooling a person's record across all challenges (hw-ext) gives a consistent gain** of 0.004–0.011 in every setting.
   It is the one signal here that plausibly generalizes, as person-level follow-through. It could go into the Beta model
   as a person-level prior, without a network.
5. **Logs from a policy that avoids level 3 cannot teach anything about level 3.** Any learned model used greedily needs a
   fallback for unsupported regions, and the logging policy needs to keep exploring.
6. **The policy gains are about ranking rules, not about learning.** Ranking by the mean instead of a draw adds 1–2 done
   days in the simulator. Done days rewards picking easy challenges and ignores level progression, so this is a product
   question.

## What it would take to show value with real data

- **Log the right things in the app,** on device and with consent:
  - day-level outcomes, which the app already stores;
  - the ranking shown;
  - the Thompson seed or the selection propensities, so that offline policy evaluation (inverse propensity or doubly
    robust) is possible;
  - the week's recommended level.
- **Evaluate prospectively.** Train on earlier people or weeks and test on later ones, split by person. Pre-register the
  metric (day-level log loss and calibration on done-only and partly-weighted targets) and the comparison: refit Beta vs
  Beta + person pooling vs the network. Report paired, person-level bootstrap intervals.
- **Get enough data.** The hw gain is about 0.0025 nats per day, roughly 0.5% of the loss. A real-data replication should
  be sized from the person-level variance of that difference, and plausibly needs hundreds of people logging for several
  weeks.
- **Run a randomized test before changing ranking.** Any change from Thompson to mean ranking, or any dropped term, should
  go through an A/B test with outcomes beyond done days: retention, level progression and self-reported change.
- **Possible public datasets for a first real-data check** (check access and licences before use):
  - **HeartSteps V1** (Klasnja et al.): a micro-randomized mobile-health trial with randomized suggestions and known
    randomization probabilities. It is a good testbed for off-policy evaluation of suggestion policies.
  - **Duolingo half-life regression data** (Settles & Meeder, 2016): per-item success after a history of attempts. It is
    a close analogue of "per-challenge Beta with pooling vs a learned model", at a much larger scale.
  - **The personality-change challenge studies that the app cites** (Hudson et al., 2019; PEACH, Stieger et al.): if
    their item-level challenge-completion data is shared (some are on OSF), it is the closest match to this app's
    domain.

## Changes made in review

- **`recommend-level.ts`:** a doc comment on `recommendLevelViaProgram` stating its domain. Behaviour is unchanged.
- **`recommend-level.test.ts`:** a new test, "domain (reviewer)", asserting the throw for a rating of 6 and the
  disagreement at 2.0000001.
- **`learn.ts`:** corrected the `policyDoneDays` comment about shared random draws. Behaviour is unchanged.
- **`greedy-check.ts`:** new, to split the greedy gain.

Results after the changes: `npx vitest run lab/handwired` gives 4 files and 55 tests passed in 2.7 s, and
`npx tsc -p lab/handwired` exits 0.
