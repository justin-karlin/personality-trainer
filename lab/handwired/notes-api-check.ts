// Executable checks for every claim and snippet in NOTES-api.md.
//   npx tsx lab/handwired/notes-api-check.ts     prints each check, plus timings
//   npx vitest run lab/handwired                 runs the same checks as a test (no timings)
import {pathToFileURL} from 'node:url'
import {
  Circuit,
  type Wire,
  emitClampExact,
  emitCompare,
  emitMaximumExact,
  emitMinimum,
  emitMinimumExact,
  emitRelu,
  emitSelect,
  validateGrids,
  validateIndexReads,
  validateTensorEvaluation,
} from './vendor/numeric-ui-core.ts'
import {createEvaluator, createSourceTable, input, inputBit, state} from './vendor/cells.ts'

export type CheckResult = {label: string, ok: boolean, detail: string}
const f = Math.fround

function throwsWith(run: () => unknown): string | null {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

// Round to nearest, ties to even, for |x| < 2^22: (x + 1.5 * 2^23) - 1.5 * 2^23 in FP32.
// Same construction as emitRound in Handwired's lab/ui-exploration/numeric-library/rounding.ts.
const roundingBase = 2 ** 23 + 2 ** 22
export function emitRoundHalfEven(circuit: Circuit, value: Wire): Wire {
  const shifted = circuit.roundAffine([[value, 1]], roundingBase)
  const rounded = circuit.roundAffine([[shifted, 1]], -roundingBase)
  circuit.markRoundingPoint(shifted)
  circuit.markRoundingPoint(rounded)
  return rounded
}

// A small program in the shape of recommendLevel's decisions, used by several checks.
export function buildWeekProgram() {
  const table = createSourceTable()
  const cells = table.declare({
    done: input([0, 64], {grid: 1}),       // completions, capped at target
    target: input([1, 64], {grid: 1, initial: 1}), // planned repetitions; initial defaults to 0, so set it
    level: input([1, 3], {grid: 1, initial: 1}),   // average level, already an integer
    disliked: inputBit(),                  // 0 or 1, written by the host
    streak: state([0, 52], {grid: 1}),     // weeks in a row that were not weak
  })
  const circuit = table.createCircuit()
  // rate >= 0.8  <=>  5 * done >= 4 * target   (cross-multiplied: no division, exact on integers)
  const strong = emitCompare(circuit, circuit.affine([[cells.done, 5]]), '>=', circuit.affine([[cells.target, 4]]))
  // rate < 0.5   <=>  2 * done < target
  const weak = emitCompare(circuit, circuit.affine([[cells.done, 2]]), '<', cells.target)
  const isEasy = emitCompare(circuit, cells.level, '===', circuit.constant(1))
  // AND of exact bits: relu(sum - (n - 1)). NOT: 1 - bit.
  const stepUp = circuit.reglu([], 1, [[strong, 1], [isEasy, 1], [cells.disliked, -1]], -1)
  // if (weak) max(level - 1, 1) else if (stepUp) 2 else level
  const down = emitMaximumExact(circuit, circuit.affine([[cells.level, 1]], -1), circuit.constant(1))
  const notWeak = emitSelect(circuit, stepUp, cells.level, circuit.constant(2))
  const nextLevel = emitSelect(circuit, weak, notWeak, down)
  // streak' = weak ? 0 : min(streak + 1, 52)
  const grown = emitMinimumExact(circuit, circuit.affine([[cells.streak, 1]], 1), circuit.constant(52))
  const nextStreak = emitSelect(circuit, weak, grown, circuit.constant(0))
  table.next(cells.streak, nextStreak)
  const output = {strong, weak, stepUp, nextLevel}
  return {cells, output, ...table.finish()}
}

function referenceWeek(done: number, target: number, level: number, disliked: number, streak: number) {
  const rate = done / target
  const strong = rate >= 0.8 ? 1 : 0
  const weak = rate < 0.5 ? 1 : 0
  const stepUp = strong && level === 1 && !disliked ? 1 : 0
  const nextLevel = weak ? Math.max(level - 1, 1) : stepUp ? 2 : level
  const nextStreak = weak ? 0 : Math.min(streak + 1, 52)
  return {strong, weak, stepUp, nextLevel, nextStreak}
}

export function runNotesApiChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (label: string, ok: boolean, detail = '') => results.push({label, ok, detail})

  // 1. Raw Circuit, no cells.ts: declare, build, evaluate.
  {
    const circuit = new Circuit(2)
    const a = circuit.source(0)
    const b = circuit.source(1)
    circuit.assumeRange(a, 0, 100)
    circuit.assumeGrid(a, 1)
    circuit.assumeRange(b, 0, 100)
    circuit.assumeGrid(b, 1)
    const ge = emitCompare(circuit, a, '>=', b)
    const gt = emitCompare(circuit, a, '>', b)
    const values = circuit.evaluateReference(Float32Array.of(3, 3))
    check('raw Circuit: 3 >= 3 is 1 and 3 > 3 is 0', values[ge] === 1 && values[gt] === 0, `>= ${values[ge]}, > ${values[gt]}`)
    const kinds = circuit.roundingPoints().map(point => point.kind)
    check('grid operands give integer bits (2 ops per compare)', kinds.length === 4 && kinds.every(kind => kind === 'integer bit'), kinds.join(','))
    const message = throwsWith(() => circuit.evaluateReference(Float32Array.of(101, 0)))
    check('evaluateReference refuses a source outside its declared range', message !== null, message ?? '')
  }

  // 2. Without grids, the same compare becomes a sign cascade; same bits, more operations.
  {
    const circuit = new Circuit(2)
    circuit.assumeRange(circuit.source(0), 0, 16_384)
    circuit.assumeRange(circuit.source(1), 0, 16_384)
    const before = circuit.operations.length
    const bit = emitCompare(circuit, circuit.source(0), '>=', circuit.source(1))
    const built = circuit.operations.length - before
    const kinds = new Set(circuit.roundingPoints().map(point => point.kind))
    check('no grid, 0..16384: >= is a sign cascade of 15 operations', built === 15 && kinds.has('sign cascade'), `${built} ops, kinds ${[...kinds].join(',')}`)
    const values = circuit.evaluateReference(Float32Array.of(f(1000.37), f(1000.37) + 2 ** -13))
    check('sign cascade resolves a 2^-13 (2 ulp) difference near 1000', values[bit] === 0, `bit ${values[bit]}`)
  }

  // 3. emitCompare refuses an operand without a finite declared range.
  {
    const circuit = new Circuit(1)
    const message = throwsWith(() => emitCompare(circuit, circuit.source(0), '>=', circuit.constant(1)))
    check('emitCompare throws on an undeclared (infinite) range', message?.includes('finite declared ranges') === true, message ?? 'no throw')
  }

  // 4. Thresholds that are not FP32 values: the constant wire holds f(t), JS compares with t.
  {
    const circuit = new Circuit(1)
    const x = circuit.source(0)
    circuit.assumeRange(x, 0, 1)
    const naive = emitCompare(circuit, x, '>=', circuit.constant(0.7))
    // The smallest FP32 value >= 0.7 reproduces JS's `x >= 0.7` for every FP32 x.
    const t = f(0.7) < 0.7 ? nextFloat32Up(f(0.7)) : f(0.7)
    const fixed = emitCompare(circuit, x, '>=', circuit.constant(t))
    const values = circuit.evaluateReference(Float32Array.of(f(0.7)))
    check('x = f(0.7): JS says x >= 0.7 is false', (f(0.7) >= 0.7) === false)
    check('naive constant(0.7) says 1 (mismatch), next-up threshold says 0', values[naive] === 1 && values[fixed] === 0, `naive ${values[naive]}, fixed ${values[fixed]}`)
  }

  // 5. Min/max: emitMinimum drifts on fractions, emitMinimumExact returns an operand.
  {
    const circuit = new Circuit(2)
    circuit.assumeRange(circuit.source(0), 0, 2000)
    circuit.assumeRange(circuit.source(1), 0, 2000)
    const loose = emitMinimum(circuit, circuit.source(0), circuit.source(1))
    const exact = emitMinimumExact(circuit, circuit.source(0), circuit.source(1))
    const clamped = emitClampExact(circuit, circuit.source(0), circuit.constant(10), circuit.constant(500))
    const values = circuit.evaluateReference(Float32Array.of(f(1000.37), f(0.3)))
    check('emitMinimum(f(1000.37), f(0.3)) drifts to 0.29998779', values[loose] === f(0.29998779), String(values[loose]))
    check('emitMinimumExact returns f(0.3) exactly', values[exact] === f(0.3), String(values[exact]))
    check('emitClampExact(1000.37, 10, 500) = 500', values[clamped] === 500, String(values[clamped]))
  }

  // 6. clamp01 with two ReLUs, abs with two ReLUs.
  {
    const circuit = new Circuit(1)
    const v = circuit.source(0)
    circuit.assumeRange(v, -10, 10)
    const clamp01 = circuit.affine([[emitRelu(circuit, v), 1], [circuit.reglu([], 1, [[v, 1]], -1), -1]])
    const abs = circuit.affine([[emitRelu(circuit, v), 1], [circuit.reglu([], 1, [[v, -1]], 0), 1]])
    const samples = [-3, -0.25, 0, 0.25, 0.75, 1, 4.5]
    const ok = samples.every(sample => {
      const values = circuit.evaluateReference(Float32Array.of(sample))
      return values[clamp01] === Math.min(1, Math.max(0, sample)) && values[abs] === Math.abs(sample)
    })
    check('relu(v) - relu(v - 1) clamps to 0..1, relu(v) + relu(-v) is abs', ok)
  }

  // 7. Rounding: ties to even, unlike Math.round.
  {
    const circuit = new Circuit(1)
    const x = circuit.source(0)
    circuit.assumeRange(x, -1000, 1000)
    const rounded = emitRoundHalfEven(circuit, x)
    const at = (value: number) => circuit.evaluateReference(Float32Array.of(value))[rounded]
    check('emitRoundHalfEven: 2.5 -> 2, 3.5 -> 4, 2.4 -> 2, -2.5 -> -2 (Math.round(2.5) = 3)',
      at(2.5) === 2 && at(3.5) === 4 && at(f(2.4)) === 2 && Object.is(at(-2.5), -2),
      `2.5->${at(2.5)}, 3.5->${at(3.5)}, 2.4->${at(f(2.4))}, -2.5->${at(-2.5)}`)
    // Through the compiled evaluator too (it must keep the stored FP32 order).
    const evaluate = circuit.createTensorEvaluator([rounded])
    check('compiled evaluator keeps round-half-even', evaluate(Float32Array.of(2.5))[0] === 2 && evaluate(Float32Array.of(3.5))[0] === 4)
  }

  // 8. Small lookup table with indexRead, e.g. 1 / n for a small integer n.
  {
    const circuit = new Circuit(2)
    const done = circuit.source(0)
    const target = circuit.source(1)
    circuit.assumeRange(done, 0, 64)
    circuit.assumeGrid(done, 1)
    circuit.assumeRange(target, 1, 64)
    circuit.assumeGrid(target, 1)
    const reciprocals = Array.from({length: 65}, (_, n) => circuit.constant(n === 0 ? 0 : 1 / n))
    const inverse = circuit.indexRead(target, reciprocals)
    const rate = circuit.multiply(done, inverse)
    const evaluate = circuit.createTensorEvaluator([inverse, rate])
    let worst = 0
    let formulaMismatches = 0
    let validationErrors = 0
    for (let t = 1; t <= 64; t++) {
      for (let d = 0; d <= t; d++) {
        const source = Float32Array.of(d, t)
        const [, got] = evaluate(source)
        if (got !== f(d * f(1 / t))) formulaMismatches++
        worst = Math.max(worst, Math.abs(got! - d / t))
        const reference = circuit.evaluateReference(source)
        if (throwsWith(() => validateIndexReads(circuit, reference)) !== null) validationErrors++
        if (throwsWith(() => validateTensorEvaluation(source, circuit, circuit.evaluateTensor(source))) !== null) validationErrors++
      }
    }
    check('indexRead 1/n table: done * table[target] equals f(done * f(1/target)) for all 0<=done<=target<=64',
      formulaMismatches === 0 && validationErrors === 0,
      `${formulaMismatches} formula mismatches, ${validationErrors} validation errors, max |error| vs float64 done/target = ${worst.toExponential(2)}`)
    const before = circuit.operations.length
    circuit.indexRead(target, reciprocals)
    check('a second read of the same table/index returns the same wire (no new op)', circuit.operations.length === before)
  }

  // 9. assumeRange after an operation reads the wire throws.
  {
    const circuit = new Circuit(1)
    const x = circuit.source(0)
    circuit.affine([[x, 2]])
    circuit.multiply(x, x)
    const message = throwsWith(() => circuit.assumeRange(x, 0, 1))
    check('assumeRange after a reader throws', message !== null, message?.slice(0, 80) ?? 'no throw')
  }

  // 10. constant(0) inside roundAffine loses the grid -> sign cascade.
  {
    const circuit = new Circuit(1)
    const count = circuit.source(0)
    circuit.assumeRange(count, 0, 1000)
    circuit.assumeGrid(count, 1)
    const before = circuit.operations.length
    emitCompare(circuit, circuit.roundAffine([[circuit.constant(0), 1], [count, 1]]), '>=', circuit.constant(3))
    const withZero = circuit.operations.length - before
    const middle = circuit.operations.length
    emitCompare(circuit, circuit.roundAffine([[count, 1]]), '>=', circuit.constant(3))
    const withoutZero = circuit.operations.length - middle
    check('running total started from constant(0) costs a sign cascade', withZero > withoutZero, `${withZero} ops vs ${withoutZero} ops (incl. the sum and constants)`)
  }

  // 11. cells.ts program: exhaustive match against plain JS, plus state write-back.
  {
    const built = buildWeekProgram()
    const evaluate = createEvaluator(built)
    const source = new Float32Array(built.initialSource)
    let mismatches = 0
    let cases = 0
    for (let target = 1; target <= 64; target++) {
      for (let done = 0; done <= target; done++) {
        for (const level of [1, 2, 3]) {
          for (const disliked of [0, 1]) {
            for (const streak of [0, 7, 52]) {
              source[built.cells.done] = done
              source[built.cells.target] = target
              source[built.cells.level] = level
              source[built.cells.disliked] = disliked
              source[built.cells.streak] = streak
              const {output, nextValues} = evaluate(source)
              const expected = referenceWeek(done, target, level, disliked, streak)
              cases++
              if (output.strong !== expected.strong || output.weak !== expected.weak || output.stepUp !== expected.stepUp
                || output.nextLevel !== expected.nextLevel || nextValues[built.cells.streak] !== expected.nextStreak) mismatches++
            }
          }
        }
      }
    }
    check(`week program matches plain JS on ${cases} cases`, mismatches === 0, `${mismatches} mismatches`)
    const fullValues = built.circuit.evaluateReference(source)
    check('validateGrids passes on an evaluated program', throwsWith(() => validateGrids(built.circuit, fullValues)) === null)
    const program = built.circuit.compileTensorProgram([...built.nextSource, built.output.nextLevel])
    check('week program size', true, `built ops ${built.circuit.operations.length}, live ops ${program.valueCount - program.sourceSize}, cells ${built.circuit.sourceSize}`)
    source[built.cells.done] = 2.5
    const message = throwsWith(() => evaluate(source))
    check('createEvaluator rejects off-grid input with the cell name', message?.includes('done must be a multiple of 1') === true, message ?? '')
    source[built.cells.done] = 0
    source[built.cells.disliked] = 0.5
    const bitMessage = throwsWith(() => evaluate(source))
    check('createEvaluator rejects a non-0/1 bit cell', bitMessage?.includes('exactly 0 or 1') === true, bitMessage ?? '')
  }

  // 12. Evaluator buffers are reused.
  {
    const built = buildWeekProgram()
    const evaluate = built.circuit.createTensorEvaluator([built.output.nextLevel])
    const first = evaluate(new Float32Array(built.initialSource))
    const second = evaluate(new Float32Array(built.initialSource))
    check('createTensorEvaluator returns the same array object every call', first === second)
  }

  // 13. Gradients: affine/ReGLU/multiply differentiate; boolean atoms and index reads refuse by default.
  {
    const circuit = new Circuit(2)
    const w = circuit.source(0)
    const x = circuit.source(1)
    circuit.assumeRange(x, 0, 10)
    const y = circuit.reglu([[w, 1]], 0, [[x, 1]], -1) // w * relu(x - 1)
    const values = circuit.evaluateReference(Float32Array.of(3, 4))
    const seed = new Float32Array(values.length)
    seed[y] = 1
    const gradients = circuit.backpropagateReference(values, seed)
    check('d(w * relu(x - 1))/dw = 3 and /dx = 3 at w=3, x=4', gradients[w] === 3 && gradients[x] === 3, `dw ${gradients[w]}, dx ${gradients[x]}`)
    const circuit2 = new Circuit(1)
    circuit2.assumeRange(circuit2.source(0), 0, 1)
    const atom = circuit2.boolean(circuit2.source(0))
    const values2 = circuit2.evaluateReference(Float32Array.of(0.7))
    const seed2 = new Float32Array(values2.length)
    seed2[atom] = 1
    const message = throwsWith(() => circuit2.backpropagateReference(values2, seed2))
    check('backprop through a boolean atom throws without straight-through', message !== null, message ?? '')
  }

  return results
}

function nextFloat32Up(value: number): number {
  const buffer = new Float32Array(1)
  const bits = new Int32Array(buffer.buffer)
  buffer[0] = value
  bits[0] = bits[0]! + (value >= 0 ? 1 : -1)
  return buffer[0]!
}

function timeEvaluations() {
  const built = buildWeekProgram()
  const viaCells = createEvaluator(built)
  const roots = [...built.nextSource, built.output.nextLevel]
  const viaTensor = built.circuit.createTensorEvaluator(roots)
  const source = new Float32Array(built.initialSource)
  source[built.cells.done] = 3
  source[built.cells.target] = 4
  const time = (label: string, run: () => unknown) => {
    for (let i = 0; i < 20_000; i++) run()
    const count = 200_000
    const start = performance.now()
    for (let i = 0; i < count; i++) run()
    const microseconds = ((performance.now() - start) * 1000) / count
    console.log(`  ${label}: ${microseconds.toFixed(3)} us/eval (${count} evals)`)
  }
  time('createEvaluator (cells.ts, validates in+out)', () => viaCells(source))
  time('createTensorEvaluator (range check only)  ', () => viaTensor(source))
  time('evaluateReference (full wire array)       ', () => built.circuit.evaluateReference(source))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = runNotesApiChecks()
  for (const {label, ok, detail} of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`)
  const failed = results.filter(result => !result.ok).length
  console.log(`${results.length - failed}/${results.length} checks passed`)
  console.log(`Timing on Node ${process.version}:`)
  timeEvaluations()
  if (failed > 0) process.exit(1)
}
