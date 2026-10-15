# Training a Handwired program's coefficients

Source: https://github.com/chenglou/handwired at commit `4ea7fcb27ebe93acf49b9f29a93e162b975bad46`. I read `src/learned-gallery/README.md`, `src/learned-gallery/trainable-geometry.ts`, the training parts of `learned-gallery.ts`, and `Circuit.backpropagateReference` plus the `multiply` and `select` macros in `src/runtime/numeric-ui-core.ts`. I also read `docs/execution-model.md` (gradients, index reads, comparisons), `lab/ui-exploration/guide/sections/differentiability.md`, `lab/user-effort/` (the closest match to our use: a small predictor with runtime features) and `lab/event-window/README.md` (soft training, then hardening).

Every claim marked **[checked]** is asserted by `lab/handwired/notes-training-check.ts` (12 checks). Section 6 lists the commands I ran and their output. Other numbers are quoted from Handwired's docs and say so.

## Short answers

| Question | Answer |
| --- | --- |
| What makes a coefficient trainable? | It has to be a **source cell**, i.e. a slot in the `Float32Array` that the program reads. A number written into an operation's terms is baked into the compiled matrix, and the backward pass has no slot for it **[checked]**. |
| How are gradients computed? | By **reverse-mode differentiation written by hand**: `circuit.backpropagateReference(values, outputGradients, options)` walks the operation list from last to first, using every wire's forward value from `circuit.evaluateReference`. It doesn't use finite differences. The gallery uses no surrogate, because its network contains no decisions. |
| What is differentiable? | Affine sums. `reglu`, with slope 0 at the ReLU's corner. The `multiply` and `select` macros, each differentiated as one operation, so `d(a·x)/dx = a` even at `x = 0` **[checked]**. |
| What is not? | The **boolean atom** throws unless you pass `{booleanGradient: 'straight-through'}`, which then acts as the identity. An **index read's index** throws unless you pass `{indexGradient: 'zero' \| 'backward-difference'}`. The table cell that the read selects always gets the gradient. **`emitCompare`** gives an exact bit and a gradient of 0 **[checked]**. |
| Loss and optimizer? | Both are plain JS outside the program. The gallery uses a Huber loss on rectangle edges plus a misalignment penalty, and seeds `dLoss/dOutput` by hand on the output wires. It then runs Adam (β 0.9/0.999, ε 1e-8, bias correction), with L2 decay 2e-7 added to the gradient, the global gradient norm clipped to 1, lr 0.008, and parameters clamped to ±6. `trainOrUndo` rolls back a frame whose steps raised the loss. |
| How is a trained coefficient written back? | `source[p] = Math.fround(source[p] - step)`, in place, in the same `Float32Array` that both evaluators read. The program is never rebuilt or recompiled. |

## 1. Where the trainable coefficients live (the gallery's network)

`createTrainableGeometryCircuit` (`src/learned-gallery/trainable-geometry.ts`, lines 207–304) builds `new Circuit(parameters.size)`. The source table holds **only** the 244 parameters. The network has no runtime inputs, because each output slot's features (the slot's position, plus sin and cos of it at 4 frequencies) are numbers known while building.

The first layer works because those features are constants. **The weight is the wire and the feature is the coefficient**, so the layer is an affine form in the parameters and needs no product:

```ts
// upstream src/learned-gallery/trainable-geometry.ts:227-251 (abridged)
const leftTerms = features.map((feature, column) => [parameterField(parameters.firstLeftWeights, neuron, inputFeatureCount, column), feature])
leftTerms.push([asWire(parameters.firstLeftBiases + neuron), 1])
// gateTerms are built the same way from firstGateWeights / firstGateBiases
first.push(circuit.reglu(leftTerms, 0, gateTerms, 0)) // ReGLU unit: left × relu(gate)
```

In the second layer and the output layer, the inputs are wires (activations), so each weight × activation is a `circuit.multiply`:

```ts
// upstream trainable-geometry.ts:187-205
function emitDynamicProjection(circuit, inputs, weightsStart, biasWire, row) {
  return circuit.affine([
    [biasWire, 1],
    ...inputs.map((input, column) => [emitMultiply(circuit, parameterField(weightsStart, row, inputs.length, column), input), 1]),
  ])
}
```

The outputs (left, top, width and height per slot, in stage fractions) are these raw affine projections. The program is 6,320 operations in 8 layers, and I measured the same numbers. `circuit.multiply` costs 1 ReGLU when one operand has a declared nonnegative range. Otherwise it costs 3 operations: two ReGLUs and an affine. In the gallery both the parameters and the activations have open ranges, so every product costs 3.

Initialization (`initializeParameters`, lines 314–377) uses a seeded LCG, uniform in roughly ±√(2/(fan_in+fan_out)), with the output weights scaled by a further 0.35. The gate biases start at about 1, so every unit starts open. The output biases start at 0.5, 0.5, 0.18 and 0.18. `initialSource` keeps a copy of the seeded values for Retrain.

Handwired's tutorial gives the rule to follow: a number that builder code knows becomes a coefficient. "Declare it as a `constant` cell instead when it should change without rebuilding the program, e.g. a margin tuned by hand or by gradients" (`docs/tutorial.md`). The guide adds a second habit: build products and selects with `circuit.multiply` and `emitSelect`, so that the backward pass differentiates them as whole operations.

## 2. How the gradients are computed

`Circuit.backpropagateReference` (`numeric-ui-core.ts:654-746`) copies `outputGradients` (one entry per wire) and visits the operations from last to first. Operations only read earlier wires, so this order is a valid reverse topological order. An operation whose output gradient is exactly 0 is skipped. Products are accumulated with `Math.fround`. The pass differentiates the intended real arithmetic, not the FP32 rounding.

| Operation | What the backward pass gives its inputs |
| --- | --- |
| `affine(terms, bias)` | `g × coefficient` to each term's wire. The constant coefficient itself gets nothing **[checked]**. |
| `reglu(left, gate)` = `left × max(0, gate)` | `g × max(0, gate)` to the left terms, and `g × left` to the gate terms **only if gate > 0**. The ReLU's corner gets slope 0 **[checked]**. |
| `circuit.multiply(a, b)` (macro) | `g × b` to `a` and `g × a` to `b`, for the whole product. Differentiating its two ReGLUs one by one would give a zero operand nothing **[checked]**. |
| `emitSelect(gate, off, on)` (macro) | `off` gets `g(1−gate)`, `on` gets `g·gate`, and the gate gets `g(on−off)` **[checked]**. |
| `boolean(score)` | Throws "cannot backpropagate through a boolean atom". With `{booleanGradient: 'straight-through'}` it passes `g` to the score unchanged **[checked]**. |
| `indexRead(index, table)` | The selected table cell gets `g`. The index throws, unless you pass `'zero'` (it gets 0) or `'backward-difference'` (it gets `read(i) − read(i−1)`) **[checked]**. |
| `emitCompare` (sign cascade or integer bits) | Made of ReLUs, so it doesn't throw. It gives 0 to both operands (the slope of a step) **[checked]**. Integer bits give ±1/grid only when a grid declaration is false (`docs/execution-model.md`). |

Practical details:

- The values must come from `circuit.evaluateReference(source)`, which returns every wire. Compiled evaluators return the requested roots or packed values. The gallery evaluates with the compiled program (`evaluateTensor`) for display and line-up bookkeeping, and with `evaluateReference` inside each training step. `validateTensorProgram` checks once, at build, that the two agree.
- The builder copies small affine sums (under 4 terms) into the operations that read them, and folds constant wires into biases. The backward pass works on the stored, composed terms, so the derivative is the same.
- The result has one entry per wire. Entries `0 … sourceSize−1` are `dLoss/dcell` for every source cell, so you get the gradient for parameters and for inputs alike. The gallery reads `gradients[0 … 243]`.
- The gallery's network has no boolean atoms, index reads or comparisons, so it calls `backpropagateReference(values, outputGradients)` with the default options. Its two non-differentiable pieces are handled in JS as **frozen decisions**: a Hungarian assignment of target rectangles to output slots, recomputed at every step and treated as constant, and the penalty's line counts and multipliers, held constant for each frame.

## 3. Loss, optimizer and write-back in the gallery

The program never computes the loss. JS computes `dLoss/dOutput` analytically and writes it into the output wires' slots (`trainStep`, `trainable-geometry.ts:703-769`):

```ts
// upstream trainable-geometry.ts (abridged)
const values = circuit.evaluateReference(source)                         // every wire
const outputGradients = new Float32Array(values.length)
// Huber on each edge: slope = clamp(error, ±0.08) / (targets × 4). A right edge = left + width, so it adds to both wires.
addEdgeGradient(targetIndex, kind, robustGradient(outputEdge - targetEdge) * gradientScale)
// misalignment penalty: ± frameStrength × pairPull(gap, multiplier, reach) / lineCount × gradientScale on the two edges
const gradients = circuit.backpropagateReference(values, outputGradients)
for (p of parameters) gradients[p] = Math.fround(gradients[p] + source[p] * weightDecay)  // L2 2e-7
const clip = Math.min(1, 1 / Math.sqrt(Σ gradients[p]²))                                 // global norm ≤ 1
for (p of parameters) {
  m[p] = 0.9 m[p] + 0.1 g;  v[p] = 0.999 v[p] + 0.001 g²                                 // Adam, bias-corrected
  source[p] = Math.fround(source[p] - lr * m̂ / (sqrt(v̂) + 1e-8))                         // ← write-back, in place
  source[p] = Math.max(-6, Math.min(6, source[p]))
}
```

- **Loss** (`measure`): the mean, over target rectangles and their 4 edges, of a Huber loss with threshold 0.08 on each output edge against its target edge. When the penalty is on, the loss also includes `penaltyStrength (2) ×` a pairwise misalignment cost between output edges of the same kind. The penalty turns on once the fit is close, at a distance below 1e-6 or after 1,000 steps, and then ramps up over 200 steps.
- **Optimizer**: Adam at lr 0.008, with the details above. Moments are `Float32Array`s.
- **`trainOrUndo(steps)`**, the page's per-frame call, snapshots the source and the moments, takes N steps, and compares the function those steps followed before and after. If it went up, the frame is undone, moments included, and the LR scale halves, down to a floor of 1/64. After 5 undone frames in a row at the floor, the scale keeps halving down to 1/4096. Each frame that is kept multiplies the scale by 1.15, or by 2 while it is below 1/64. The README explains why: Adam at a fixed LR "doesn't come to rest once the loss is low", and the photos jumped by up to 14 px. My plain `train()` run shows the same effect: the loss went from 2.8e-12 at step 500 to 1.6e-8 at step 1,000 (section 6).
- **Write-back**: the trained coefficients are the program's source table. `machine.source` is the array that `evaluateTensor` reads on the next frame, so a coefficient changes the program's output at the next evaluation, with no rebuild. Ranges are still checked on each evaluation (`validateSourceRanges`). A NaN parameter, or one outside a declared range, throws. The gallery leaves its parameters undeclared, so their range is open.

## 4. What carries over to this app, and what doesn't

- Our inputs change at runtime: rates, levels, ratings. So we need both **parameter cells and input cells** in one source table. `lab/user-effort/predictor.ts` in Handwired does exactly that: 5 parameter cells plus 3 feature cells, `Circuit.multiply` for weight × feature, `roundAffine` for the sum, a full-batch Adam loop around `backpropagateReference`, and fixed JS preprocessing for `log2`. `lab/reusable-layout` does the same for a larger network.
- The runtime has **no division, exp or log**. The host computes features like `1/(alpha+beta)` or `log2(1+d/w)`. A trainable cell must not sit inside a host-computed feature, or its gradient misses that path.
- **Decisions don't train.** An exact `emitCompare` bit gives its threshold a gradient of 0 **[checked]**. The guide's recommendation, which I follow below, is: keep the run-time program exact, take gradients only where the math is continuous, and for thresholds train a soft build (a clamped ramp) and then harden it into the exact build. Handwired's `lab/event-window` did this for a drag slop and a title-bar height. Per the guide's differentiability section, all 20 seeds recovered the right bands. Two alternatives: search over a few candidate values, evaluating each as an instance of the exact program, or straight-through.

## 5. A small predictor whose initial coefficients reproduce a rule exactly, then fine-tune

### Recipe

1. **Host features.** Compute in JS what the rule reads: a rate, an average level, a mean rating. Write each into an input cell and declare its range: `assumeRange`, `assumeBit`, `assumeOneHot`.
2. **Coefficients become cells.** Every constant of the rule that you might want to learn goes into a parameter cell at the front of the source table, initialized to the rule's value. Constants you won't learn can stay as term coefficients.
3. **Two build modes from one builder.** `'exact'` builds each comparison with `emitCompare` (or a boolean atom) and is what runs. `'soft'` replaces each comparison with `clamp01((a − b)·sharpness + 0.5)` and is what trains. Both read the same cells. A continuous rule needs only one mode.
4. **Prove that the initial program is the rule.** Enumerate the input domain and compare the exact program's output with the real JS function using `===`. Spot-check the reference evaluator against the compiled one.
5. **Fine-tune.** Compute the loss in JS, seed `outputGradients[output] = dLoss/dOutput`, run `backpropagateReference`, step Adam on the parameter slice, and write back with `Math.fround`. Add an **anchor**, `λ·(θ − θ_rule)`, rather than weight decay toward 0, so that parameters the data says little about stay at the rule's values. Group examples that have identical inputs: the gradient of a sum is the sum of the gradients, so each group needs one forward and one backward pass.
6. **Harden and verify.** Copy the tuned cells into the exact build, run step 4 again against the reference you now intend, and report how many inputs changed their decision compared with the old rule.

### 5a. `recommendLevel` with its thresholds in cells (exact rule, trainable cut points)

`lab/handwired/notes-training-check.ts` (`buildLevelProgram`, `levelInputs`) puts 0.5 (step down), 0.8 (step up) and 2 (the "disliked" enjoyment threshold) into cells 0–2:

```ts
// lab/handwired/notes-training-check.ts
import {Circuit, emitCompare, type Wire} from './vendor/numeric-ui-core.ts'
import {completionRate, recommendLevel} from '../../src/lib/program.ts'

const atLeast = (a: Wire, b: Wire): Wire => {          // [a >= b]
  if (mode === 'exact') return emitCompare(c, a, '>=', b)
  const d = c.roundAffine([[a, 1], [b, -1]])
  const z = c.multiply(d, w(levelCell.sharpness))     // sharpness is an input cell, so one soft build serves every annealing step
  const r = c.reglu([], 1, [[z, 1]], 0.5)              // relu(z + 0.5)
  return c.affine([[c.reglu([], 1, [[r, -1]], 1), -1]], 1) // clamp01(z + 0.5)
}
const geLow = atLeast(rate, lowCut), high = atLeast(rate, highCut)
const disliked = c.multiply(hasRatings, atLeast(dislikeCut, meanEnjoy))
const down = c.multiply(not(geLow), not(lv1))                          // rate < lowCut, not already at 1
const up = c.multiply(c.multiply(geLow, high), c.multiply(not(disliked), lv1))
const level = 1 + has × (lv1 + 2·lv2 + 3·lv3 − 1 − down + up)          // built with roundAffine + multiply
```

The host writes `rate = completionRate(...)` (float64, rounded to FP32 by the array), the one-hot of `clampLevel(Math.round(mean level))`, and the mean enjoyment.

- **Exact at init [checked]:** at cells (0.5, 0.8, 2), the exact program equals `recommendLevel(prev, 'C', library)` on **573,051 enumerated weeks with 0 mismatches**. The enumeration covers no week, an empty week, other-trait-only weeks, and every single and paired commitment over levels 1–3, targets 1–7, completions 0 to target+1, and enjoyment unrated or 1–5. The reference and compiled evaluators agree on the spot checks. The program has 56 live operations in 21 layers. Exactness rests on two facts: rounding to FP32 never reorders values, and none of these rates comes within an FP32 step of a cut.
- **Soft gradients [checked]:** at sharpness 8, `lowCut` and `highCut` get `dlevel/dcut = −8` within ±1/16 of the cut and 0 outside. At level 2 and rate 0.45 the soft level is 1.1 and `dlevel/dlowCut = −8`. At rate 0.2 the gradient is 0. That is why event-window had to anneal from a wide ramp to a narrow one.
- **What I didn't do:** fine-tune these cuts. The blocker is that there is no label. Logs show outcomes only at the level we chose, so supervised fine-tuning from real logs is confounded, which makes it an off-policy problem. Labels from `simulate.ts`, e.g. "the level whose suggestions maximize this simulated person's expected done days", would only teach the simulator's assumptions back to us.

### 5b. The expected done share from `personalize.ts`, with priors in cells, fine-tuned (worked end to end)

This rule predicts something that each logged day labels directly: the share of opportunities on which a challenge gets done. `buildExpectedDoneProgram` computes `posteriorMean(priorFor(...) + own record)`. `priorMean[1..3]` and `barrierBonus` are cells 0–3. `priorStrength` (k = 8) and `techniqueWeight` (0.5) stay as coefficients, for the reason below.

```ts
// lab/handwired/notes-training-check.ts
import {DEFAULT_PARAMS, posteriorMean, priorFor, rng} from '../../src/lib/personalize.ts'
import {makePerson} from '../../src/lib/simulate.ts'

const raw = c.roundAffine([[c.multiply(lv1, pm1), 1], [c.multiply(lv2, pm2), 1], [c.multiply(lv3, pm3), 1], [c.multiply(fits, bonus), 1]])
const mean = c.roundAffine([[c.reglu([], 1, [[raw, 1]], -0.05), 1], [c.reglu([], 1, [[raw, 1]], -0.95), -1]], 0.05) // clamp(raw, .05, .95)
const alpha = c.roundAffine([[mean, k], [techniqueSuccess, techniqueWeight], [ownSuccess, 1]])
const expected = c.multiply(reciprocal, alpha)  // host writes 1/(k + techniqueWeight·(S+F) + s + f): no trainable cell inside

// fine-tune step (fineTunePriorMeans), one forward and one backward pass per group of identical inputs:
const values = circuit.evaluateReference(source)
outputGradients[expected] = 2 * (group.days * values[expected] - group.sumY) / totalDays // d MSE / d prediction
const backward = circuit.backpropagateReference(values, outputGradients)
// Adam on backward[0..3] (+ anchor·(θ − θ_rule)), then source[p] = Math.fround(source[p] - step)
```

- **Equals the rule at init [checked]:** over 12,168 grid cases (levels × barrier fit × own and technique records in half-days), the maximum |program − personalize.ts| is **9.3e-8**, and 8,135 cases are bit-equal to `Math.fround(JS)`. This rule is continuous, so "exact" here means the same formula and the same coefficients, evaluated in FP32. It doesn't mean bit-for-bit equality with float64. Section 5a's discrete rule is bit-exact.
- **Gradient check [checked]:** at level 1 with 2 done days and 1 skipped day, `d expected/d priorMean[1]` from the backward pass is 0.727273, and a central difference gives 0.727266. Both match k/(k+n) = 8/11.
- **Fine-tune [checked]:** the data is 25,073 logged first-week days from 300 `makePerson` people, using `simulate()`'s day loop with done = 1, partly = 0.5 and skipped = 0. I ran 600 full-batch Adam epochs at lr 0.01. `priorMean` moved from **0.70 / 0.55 / 0.40 to 0.6632 / 0.5745 / 0.4728**, which equals the training days' per-level mean to within 1e-3. That is the correct minimizer for this model. For comparison, the simulator's population means over 5,000 fresh people are 0.6613 / 0.5620 / 0.4633. `barrierBonus` stays at 0.08, because the simulator has no barrier feature, so its gradient is exactly 0. With anchor λ = 0.1 the result is 0.6672 / 0.5718 / 0.4567, which matches the closed-form compromise between the rule and the data **[checked]**.
- **Why k and techniqueWeight stay as coefficients:** they appear in the denominator, which the host computes. To tune them, either search a few values by evaluating instances of the program (cheap with 2 parameters), or move the reciprocal into the program. The runtime has no reciprocal function. The numeric-library division in Handwired's lab is not vendored here.
- **Honest scope:** for this tiny model, fine-tuning just computes per-level averages, and closed-form means would do the same. What the example shows is the plumbing: rule-exact initialization, gradients from the program itself, write-back, an anchor, and checks. That plumbing carries over to models with more features, e.g. technique, time of day, plan wording or week number, where no closed form exists. It also shows where gradients vanish: once `raw` is clamped at 0.05 or 0.95, its slope is 0.

### 5c. Caveats to remember

- **Dead zones:** ReLU corners and clamps give 0, and a soft ramp gives 0 beyond half its width. The gallery fights dead ReGLU units with a small weight decay, and reports that without decay 2 to 4 of its 6 first-layer units could end shut.
- **Fixed-LR Adam doesn't settle.** For anything shown live, use a rollback or a decaying LR, as `trainOrUndo` does.
- **Declared ranges are enforced on every evaluation.** If you declare a range on a trainable cell (5a declares 0..1 on the cuts), clamp the cell to that range after each step, or the next evaluation throws.
- **Simulated labels encode our assumptions** (`simulate.ts` says so itself). Tuned values are candidates for `DEFAULT_PARAMS` only after they have been checked on held-out real logs.

## 6. What I ran

Every command was run from `/home/user/personality-trainer` on Node v22.22.2.

```
$ npx tsx lab/handwired/notes-training-check.ts
PASS ×12 (the labels are in the check file). Highlights:
  exact level program ... equals recommendLevel  [573051 weeks, 0 mismatches, 0 reference/tensor mismatches; 56 live ops, 21 layers]
  expected-done program ... within FP32 rounding  [12168 cases, 8135 bit-equal to Math.fround(JS), max |program − JS| = 9.34e-8]
  fine-tuning (no anchor) ...  [rule 0.7, 0.55, 0.4 -> learned 0.6632, 0.5745, 0.4728; data mean 0.6632, 0.5745, 0.4728; 25073 days]
  fine-tuning with an anchor ...  [anchor 0.1: learned 0.6672, 0.5718, 0.4567; closed form 0.6672, 0.5718, 0.4567]
12/12 checks passed in 1196 ms on Node v22.22.2
simulator population mean done share by level (5,000 fresh people): 0.6613, 0.5620, 0.4633
(wall time 2.4 s)

$ npx vitest run lab/handwired
Test Files  2 passed (2)   Tests  38 passed (38)   Duration 2.79s   (this file's 12 + NOTES-api's)

$ npx tsc -p lab/handwired      → exit 0
```

I set `noUncheckedIndexedAccess` to **false** in `lab/handwired/tsconfig.json`, the only change to a file I didn't create, with a comment explaining it. The check imports `src/lib/*.ts`, so `tsc -p lab/handwired` now type-checks those files too. With the option on, it reported 5 errors inside `src/lib/dates.ts` and `src/lib/simulate.ts`, which aren't written for that option. With it off, the lab and `src/` both pass. `npm run typecheck` is unaffected.

Upstream gallery trainer, unchanged, run from a scratch script against the clone. This isn't reproducible from the repo, because `trainable-geometry.ts` isn't vendored:

```
$ npx tsx /tmp/claude-0/-home-user-personality-trainer/3d79c6ec-5983-5ceb-818b-84ca342993d0/scratchpad/hwcheck/gallery.ts   # session scratch file; 3 target rectangles, 20 slots, plain machine.train()
parameterCount 244 built ops 6320 live ops 6320 layers 8
step 0 loss 1.832e-2 | step 100 loss 2.912e-7 | step 500 loss 2.776e-12 | step 1000 loss 1.556e-8
ms per train step (incl. evaluate per step): 0.868     # Node/tsx on this machine. Upstream quotes ~0.2 ms in Bun on an M5 Max
parameters changed from the seeded values: 244 of 244
```

The rise between step 500 and step 1,000 is the fixed-LR Adam overshoot that `trainOrUndo` exists to suppress.

## Files

- `lab/handwired/NOTES-training.md`: this note.
- `lab/handwired/notes-training-check.ts`: `buildLevelProgram`, `levelInputs`, `buildExpectedDoneProgram`, `expectedDoneInputs`, `simulatedFirstWeekDays`, `fineTunePriorMeans`, and the 12 checks.
- `lab/handwired/notes-training.test.ts`: runs the checks under vitest.
- Vendored runtime used: `lab/handwired/vendor/numeric-ui-core.ts`, from upstream `src/runtime/numeric-ui-core.ts` at the commit above, unmodified apart from its header (MIT, `vendor/LICENSE`).
