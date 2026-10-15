# Handwired API cheat-sheet (for lab/handwired)

Source: https://github.com/chenglou/handwired at commit `4ea7fcb27ebe93acf49b9f29a93e162b975bad46`. This sheet comes from docs/README.md, tutorial.md, expressions.md and execution-model.md, plus a reading of `src/runtime/numeric-ui-core.ts` and `src/runtime/cells.ts`. Every claim marked **[checked]** is asserted by `lab/handwired/notes-api-check.ts`. The other numbers are quoted from the Handwired docs.

## 0. Mental model in 6 lines

- A **program** is a fixed list of FP32 operations. You build it once with ordinary TS "builder code" that appends to a `Circuit`. At runtime it has no branches and no loops. Every step rounds like `Math.fround`.
- The program reads one `Float32Array`, the **source table**. Each number in it is a **cell**: an input, a constant, an event bit or a state value.
- A **wire** (`Wire`, a branded `number`) is the position of a value. Source cells come first, then one position for each operation.
- There are 4 instructions: `affine` (bias + Σ coef·wire), `reglu` (`left × max(0, gate)`), `boolean` (rounds a score in 0..1 at 0.5), and `index` (a table read). Everything else is a macro built from these.
- **Declarations** (range, grid, one-hot, bit) are promises that the builder relies on to choose a construction. The evaluators check source ranges on every call. The rest is checked only by test helpers.
- `if` becomes `emitSelect`, which computes both sides. A loop becomes a count, a table, a tree, or the same work on every item.

## 1. Imports (vendored copies in this folder)

```ts
// From a file in lab/handwired/:
import {
  Circuit, type Wire, type Terms, asWire,
  emitCompare, emitSelect, emitMultiply, emitRelu,
  emitMinimum, emitMaximum, emitMinimumExact, emitMaximumExact, emitClampExact,
  emitArgmax, emitFirstActive, inlineCircuit,
  validateGrids, validateIndexReads, validateOneHotGroups, validateNoNaN, describeFirstNaN,
  validateTensorEvaluation,
} from './vendor/numeric-ui-core.ts'          // upstream: src/runtime/numeric-ui-core.ts
import {
  createSourceTable, createEvaluator,
  input, inputBit, constant, state, stateBit, event, list, oneHot, permutation,
  type CellWires, type SourceTable,
} from './vendor/cells.ts'                    // upstream: src/runtime/cells.ts (imports ./numeric-ui-core.ts)
```

`vendor/` holds both files, unmodified apart from a 3-line header naming the repo and commit, and also the MIT `LICENSE`. Both files are self-contained: no imports beyond each other, no Bun APIs, and they run under Node 22 with `tsx` and `vitest` **[checked]**. Imports use the `.ts` extension, so a `tsc` check needs `allowImportingTsExtensions`. `lab/handwired/tsconfig.json` sets it: `npx tsc -p lab/handwired` passes.

The runtime has **no** round, floor, division, reciprocal or sqrt functions. Those live in Handwired's `lab/ui-exploration/numeric-library/` (`rounding.ts`, `arithmetic.ts`), which is not vendored here. To use them, copy them and change their import of `../../../src/runtime/numeric-ui-core.ts` to `./numeric-ui-core.ts`.

## 2. Declaring cells and inputs

### 2a. With cells.ts (recommended)

```ts
const table = createSourceTable()
const cells = table.declare({                      // returns wires in the same shape
  done:     input([0, 64], {grid: 1}),             // host writes it; kept
  target:   input([1, 64], {grid: 1, initial: 1}), // `initial` defaults to 0 and finish() validates it!
  disliked: inputBit(),                            // exactly 0 or 1
  streak:   state([0, 52], {grid: 1}),             // program computes the next value
  // constant(12, [0, 100]) -> tunable without rebuilding; event() -> host sets 1, program resets to 0
  // list(n, i => spec), oneHot([...stateBit()]), permutation(order)
})
const circuit = table.createCircuit()              // calls assumeRange/assumeGrid/assumeBit/assumeOneHot for every cell
// ...builder code...
table.next(cells.streak, nextStreak)               // every state cell gets exactly one next value
const built = {cells, output: {nextLevel, weak}, ...table.finish()} // {circuit, nextSource, initialSource, validate}
```

| Declaration | Lifecycle | Notes |
| --- | --- | --- |
| `constant(value, range, {grid})` | in the initial table, kept | changing it does not need a rebuild |
| `input(range, {initial, grid})` | host writes it before an evaluation, kept | |
| `inputBit(initial)` | input that must be exactly 0 or 1 | |
| `event({grid})` | host sets 1, next value is 0 | |
| `state(range, {initial, grid})` / `stateBit(initial)` | next value from `table.next` | |

A **range** must be finite wherever a comparison reads the cell. A **grid** is a power of two (`1`, `1/64`, …) that every value is a multiple of. Grids make comparisons about 7× cheaper (see §3).

### 2b. Raw Circuit (no cells.ts)

```ts
const circuit = new Circuit(2)                     // source size is fixed up front
const a = circuit.source(0), b = circuit.source(1)
circuit.assumeRange(a, 0, 100); circuit.assumeGrid(a, 1)   // declare BEFORE any op reads the wire
circuit.assumeRange(b, 0, 100); circuit.assumeGrid(b, 1)
const ge = emitCompare(circuit, a, '>=', b)
circuit.evaluateReference(Float32Array.of(3, 3))[ge]       // 1   [checked]
```

There is also `circuit.assumeOneHot(members, allowAllZero?)` and `circuit.assumeBit(wire)`. A number known at build time should be a coefficient, a bias or `circuit.constant(v)`, not a cell.

## 3. Builder functions by need

Costs are counts of built operations. "Grid" means both operands are declared on grids.

| Need (JS) | Handwired | Cost / notes |
| --- | --- | --- |
| weighted sum `0.5*w - 26` | `circuit.affine([[w, 0.5]], -26)` | Terms are `[wire, coef]`. With `.map`, write `[bit, 1] as const`. An affine sum with fewer than 4 terms is copied into its readers |
| keep this exact FP32 sum | `circuit.roundAffine(terms, bias)` | keeps term order and rounding, and is never inlined. Don't mutate `terms` afterwards |
| `max(0, x)` | `emitRelu(circuit, x)` = `circuit.reglu([], 1, [[x, 1]], 0)` | 1 op |
| `a * b` (both runtime) | `emitMultiply(circuit, a, b)` / `circuit.multiply(a, b)` | 1 op if one side has a declared range ≥ 0, otherwise 3. Equals `f(a*b)` |
| `a >= b`, `>`, `<`, `<=`, `===` | `emitCompare(circuit, a, '>=', b, {endWithBoolean?})` → exact 0/1 wire | Grid: **2 ops** (3 for `===`) **[checked]**. No grid, 0..16384: **15 ops** for `>=` and 16 for `>` (sign cascade) **[checked]**. Both ranges must be finite, or it throws **[checked]** |
| `a !== b` | `circuit.affine([[emitCompare(c, a, '===', b), -1]], 1)` | |
| threshold `x >= 3` | `emitCompare(c, x, '>=', circuit.constant(3))` | The constant folds into the bias. A plain `3` is wire #3 (see gotchas) |
| `!bit`, `a && b && c`, `a \|\| b` | `affine([[bit,-1]],1)`; `reglu([],1,[[a,1],[b,1],[c,1]],-2)`; `1 - relu(1 - a - b)` | Exact on exact bits. OR is just `a+b` when they can't both be 1 |
| `cond ? on : off` | `emitSelect(circuit, cond, off, on)` (**off first!**) | 4 ops if cond's range is within 0..1, 8 otherwise. Exact at cond = 0 or 1 for finite operands. An unselected `Infinity` gives NaN |
| `Math.min/max(a,b)` exact | `emitMinimumExact(c,a,b)` / `emitMaximumExact(c,a,b)` | A compare plus a select, so it returns one of the operands exactly. Needs finite ranges. Ties return `a` |
| `Math.min/max(a,b)` cheap | `emitMinimum` (`a - relu(a-b)`) / `emitMaximum` (`b + relu(a-b)`) | 3 ops. Exact only for integers below 2^23. `emitMinimum(f(1000.37), f(0.3))` = 0.29998779 **[checked]** |
| clamp `min(max(v,lo),hi)` | `emitClampExact(c, v, lo, hi)` (lo and hi are wires, e.g. `circuit.constant(10)`) | Exact. (1000.37, 10, 500) → 500 **[checked]**. Returns `hi` when lo > hi (per source comment) |
| clamp to 0..1 | `affine([[relu(v),1],[reglu([],1,[[v,1]],-1),-1]])` | Plateau exact while v ≤ 2^24 (and less when v is a small inlined sum) **[checked]** |
| `Math.abs(x)` | `relu(x) + relu(-x)` | **[checked]** |
| `Math.round(x)` | `roundAffine([[x,1]], 1.5·2^23)` then `roundAffine([[that,1]], -1.5·2^23)`, plus `markRoundingPoint` on both | 2 ops, for \|x\| < 2^22. **Ties go to even**: 2.5→2, 3.5→4, -2.5→-2, where `Math.round(2.5)` is 3 **[checked]**. Same as `emitRound` in numeric-library and in handwiredos/value-list.ts |
| `Math.floor` | numeric-library `emitFloor` (7 ops, x ≥ 0), `emitFloorOnGrid` (3 ops), `emitFloorDivide(c, n, constDivisor)` (8 ops) | not in the runtime |
| small lookup table `T[i]` | `circuit.indexRead(i, candidates, {outOfRange: 'clamp' \| 'zero'})` | **1 op at any size.** Copies `candidates[floor(i)]` with no rounding. `i` needs a declared range strictly inside ±2^24 and must hold an integer. The read gets **no grid**: call `assumeGrid(read, 1)` before comparing it, or the compare becomes a 15-op cascade |
| `cond ? T[i] : 0` | `circuit.indexReadAffine([[i,1],[cond,-n]], n, T, 'clamp', 'zero')` | 1 op |
| one-hot select `Σ sel[j]·v[j]` | `affine` over `multiply(sel[j], v[j])`. `assumeOneHot(sel)` compiles it to one gather | |
| argmax / first true | `emitArgmax(c, scores, unit)` → `{selected, score}`; `emitFirstActive(c, gate, bits)` → one-hot | argmax needs scores in 0..1 and a `unit` declared as exactly 1, and its tie band is about 1e-7 |
| `x / k`, constant k | `affine([[x, 1/k]])` | Rounds: the coefficient is `f(1/k)` and the product rounds too. Not exact |
| `x / y`, runtime y | **(a)** compare without dividing: `done/target >= 0.8` ⇔ `5·done >= 4·target` (exact on integers) **[checked, 38,592 cases]**. **(b)** small-integer y: `indexRead(y, [const(0), const(1/1), …, const(1/64)])` then `multiply` = `f(x·f(1/y))`, 2 ops, \|err\| ≤ 8.0e-8 for 0 ≤ x ≤ y ≤ 64 **[checked]**. **(c)** host writes `1/y` into a cell. **(d)** numeric-library `emitReciprocal`/`emitDivide` (Newton): measured 26 live ops over 1..64 and 50 over 1..16384, max relative error 9.9e-8 on 100k samples (a scratch run, not in the check script) | (a) and (b) are the practical choices for counts and rates |

## 4. Evaluating from plain TypeScript (Node, no browser)

```ts
// (1) cells.ts evaluator: checks ranges, grids, bits and one-hots on input AND next values; returns shaped output
const evaluate = createEvaluator(built)            // built = {circuit, nextSource, validate, output}
const source = new Float32Array(built.initialSource)
source[built.cells.done] = 3; source[built.cells.target] = 4
const {output, nextValues} = evaluate(source)      // output.nextLevel is a number; nextValues is aligned with cells
source.set(nextValues)                             // write state back (it also resets event cells to 0)

// (2) Fast path: checks only source ranges. Returns the roots in order, in ONE REUSED array
const run = built.circuit.createTensorEvaluator([built.output.nextLevel, built.output.weak])
const [nextLevel, weak] = run(source)              // copy it if you keep it: the next call overwrites it [checked]

// (3) Reference: every wire's value (Float32Array indexed by wire). Use it for tests, debugging and gradients
const values = built.circuit.evaluateReference(source)   // values[anyWire]
// built.circuit.evaluateTensor(source) is the same through the compiled program (removed wires read 0)
// const program = circuit.compileTensorProgram(roots); circuit.createTensorProgramEvaluator(program) compiles once
// and also exposes .packedValues; live op count = program.valueCount - program.sourceSize
```

Timing **[checked, one run, Node v22.22.2 in this container, 5-cell / 36-live-op program, 200k evaluations]**: `createEvaluator` 1.36 µs/eval, `createTensorEvaluator` 0.60 µs/eval, `evaluateReference` 4.97 µs/eval. Recreate an evaluator after you change the circuit.

**Gradients** (for training constants that live in cells, as in learned-gallery/trainable-geometry.ts): `const values = circuit.evaluateReference(src); const seed = new Float32Array(values.length); seed[outWire] = 1; const g = circuit.backpropagateReference(values, seed)` gives g[wire] = d out / d wire, including for source cells. For `w·relu(x−1)` at w=3, x=4 it returns dw=3, dx=3 **[checked]**. Boolean atoms throw unless you pass `{booleanGradient: 'straight-through'}` **[checked]**. Index reads throw unless you pass `{indexGradient: 'zero' | 'backward-difference'}`. Comparison bits pass zero gradient to their operands.

## 5. Exactness guarantees

- **FP32 everywhere:** `value = f(bias); for each term: value = f(value + f(f(coef) * x))`, in stored term order. The compiled evaluator reproduces the reference evaluator bit for bit, which `validateTensorEvaluation` checks. "Exact" always means equal to that FP32 computation, never to float64 JS.
- **`emitCompare`:** the bit equals JS's comparison of the two **FP32 values** for every pair inside the declared ranges, subnormal differences included. Requirements: both ranges are finite and their difference can't overflow. Grid form: every partial sum stays within 2^24 grid steps, otherwise it falls back to the cascade with the same bits. `{endWithBoolean: true}` saves an op or two but needs FP32-faithful execution and breaks gradients.
- **Thresholds that aren't FP32 values:** `circuit.constant(0.7)` holds `f(0.7)` = 0.69999999, which is below 0.7. So for x = f(0.7), `emitCompare(x,'>=',constant(0.7))` gives 1 where JS `x >= 0.7` gives false **[checked]**. To reproduce JS, use the smallest FP32 value ≥ t. Better: avoid fractional thresholds by cross-multiplying integers.
- **The FP32 input is not the float64 input:** a rate computed in float64 JS and one computed in FP32 can sit on opposite sides of a threshold, e.g. `f(f(1732−24)·f(1/244))` = 6.9999995 where float64 gives 7. Compare integers, or compare against thresholds, instead of comparing a divided value.
- **Select** at exactly 0 or 1 returns the operand exactly at any finite magnitude. **Multiply** equals `f(a·b)`.
- **Magnitude limits:** integers are exact up to 2^24. `emitMinimum`/`emitMaximum`/clamp01 are reliable for integers below 2^23. Rounding needs |x| < 2^22. An index needs |i| < 2^24.
- **Index reads** copy the value with no rounding (`-0`, `Infinity` and `NaN` pass through). A fractional index floors.

## 6. Gotchas

1. **A plain number where a `Wire` is expected is a wire index.** `emitCompare(c, x, '>=', 3)` compares with cell/op #3. `tsc` rejects it ("number is not assignable to Wire"), but **tsx and vitest don't type-check**, so at runtime it silently reads wire 3 (or throws for an unrelated reason). Run `npx tsc -p lab/handwired`. The reverse mistake, a wire where a number is expected (e.g. as a bias), is not caught at all.
2. **Declare before reading.** `assumeRange`/`assumeGrid` throw once an op already reads the wire **[checked]** (`{allowExistingReaders: true}` overrides this, but the earlier ops keep the old construction). Declare everything up front. cells.ts does this for you.
3. **`initial` defaults to 0** and `table.finish()` validates the initial table, so `input([1, 64])` without `initial: 1` throws `target must be finite and within 1..64, got 0` **[hit while writing the check]**.
4. **Grids decide cost, not correctness.** An off-grid value is rejected by `createEvaluator` (`done must be a multiple of 1, got 2.5`) **[checked]**, but `evaluateReference` and `createTensorEvaluator` check only ranges. A false grid declaration silently gives wrong bits. Run `validateGrids(circuit, values)` in tests.
5. **`circuit.constant(0)` has no grid**, so `roundAffine([[constant(0),1],[count,1]])` loses the grid and its compare becomes a cascade (18 ops vs 3 measured) **[checked]**. Start sums from the first item.
6. **`indexRead` results have no grid.** Call `assumeGrid(read, 1)` before comparing. The index must be an integer; `validateIndexReads` checks this in tests.
7. **`emitSelect(c, cond, off, on)`**: the *off* value comes before *on*. Both sides are always computed, so an infinite or NaN unselected side poisons the result.
8. **Hash-consing and aliasing:** an identical expression returns the existing wire, even with its terms reordered, and `affine([[x,1]])` returns `x` itself. Use `roundAffine` to force a separate op (verified in a scratch run).
9. **Small affine sums (fewer than 4 terms) are inlined** into their readers and re-rounded there. When a sum must keep its own rounding, e.g. an integer bit `relu(s)-relu(s-1)` read with fractional weights, keep it as `roundAffine`.
10. **`Math.round` ties up, the FP32 trick ties to even.** A level average like 2.5 rounds differently. For `Math.round(sum/n)` with integers, count thresholds instead: `round(sum/n) ≥ k` ⇔ `2·sum ≥ (2k−1)·n`.
11. **Buffers are reused:** `createTensorEvaluator`'s output array is overwritten on the next call **[checked]**. `createEvaluator`'s `nextValues` is a subarray of that same reused buffer (from reading cells.ts).
12. **No early exit:** every op runs on every evaluation. A state cell whose next value leaves its declared range makes `createEvaluator` throw, so size state ranges for the worst case or clamp before `table.next`.
13. **NaN debugging:** `describeFirstNaN(circuit, values)` / `validateNoNaN(circuit, values)` name the op that produced it. `createEvaluator` adds this to its error message automatically.

## 7. Test helpers

`validateGrids`, `validateIndexReads`, `validateOneHotGroups`, `validateNoNaN` take `(circuit, circuit.evaluateReference(source))`. `validateTensorEvaluation(source, circuit, circuit.evaluateTensor(source))` compares the compiled program with the reference. `built.validate(source)` checks a table against every cell declaration. `circuit.roundingPoints()` lists `{wire, kind}` with kinds `'integer bit' | 'sign cascade' | 'boolean' | 'marked'`. Count them to see which construction each compare got.

## 8. Verification (commands actually run)

```
$ npx tsx lab/handwired/notes-api-check.ts
PASS ... (26 lines)
26/26 checks passed
Timing on Node v22.22.2:
  createEvaluator (cells.ts, validates in+out): 1.361 us/eval (200000 evals)
  createTensorEvaluator (range check only)  : 0.603 us/eval (200000 evals)
  evaluateReference (full wire array)       : 4.971 us/eval (200000 evals)

$ npx vitest run lab/handwired
 Test Files  1 passed (1)
      Tests  26 passed (26)      Duration 612ms

$ npx tsc -p lab/handwired        # exit 0 (TypeScript 7.0.2)
```

The week program in the check (5 cells; rate ≥ 0.8 and < 0.5 by cross-multiplying, level ===, AND, nested selects, exact min/max, one state cell) has 38 built ops, 36 live, and matches plain float64 JS on 38,592 exhaustive cases (target 1..64, done 0..target, 3 levels, 2 disliked values, 3 streaks) **[checked]**.
