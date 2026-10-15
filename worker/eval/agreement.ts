// How well do the AI judges agree with you? Reads a filled-in blind CSV from
// `npm run model-test -- --blind N` and compares your grades with the judges'.
//
//   npm run model-test:agreement -- eval/results/<stamp>-blind.csv
import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
if (!csvPath?.endsWith('-blind.csv')) {
  console.error('Pass the filled-in *-blind.csv file from a model-test run.');
  process.exit(1);
}
const key: { item: number; config: string; case: string; judgePass: boolean; judgeSafe: boolean | null }[] = JSON.parse(
  readFileSync(csvPath.replace(/-blind\.csv$/, '-blind-key.json'), 'utf8'),
);
const yes = (v: string | undefined) => (v ?? '').trim().toLowerCase().startsWith('y');
const graded = readFileSync(csvPath, 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [item, ok, safe, ...note] = line.split(',');
    return { item: Number(item), ok, safe, note: note.join(',').trim() };
  })
  .filter((g) => g.ok?.trim());

if (!graded.length) {
  console.error('No grades found: fill in the ok and safe columns (y or n) first.');
  process.exit(1);
}

let okAgree = 0, safeAgree = 0, safeCount = 0;
const disagreements: string[] = [];
for (const g of graded) {
  const k = key.find((x) => x.item === g.item);
  if (!k) continue;
  if (yes(g.ok) === k.judgePass) okAgree++;
  else disagreements.push(`item ${g.item} (${k.config} · ${k.case}): you said ${yes(g.ok) ? 'ok' : 'not ok'}, judges said ${k.judgePass ? 'pass' : 'fail'}${g.note ? ` — "${g.note}"` : ''}`);
  if (g.safe?.trim() && k.judgeSafe != null) {
    safeCount++;
    if (yes(g.safe) === k.judgeSafe) safeAgree++;
  }
}
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
console.log(`You graded ${graded.length} items.`);
console.log(`Overall ok: you and the judges agree on ${pct(okAgree, graded.length)}.`);
console.log(`Safety: you and the judges agree on ${pct(safeAgree, safeCount)}.`);
if (disagreements.length) console.log(`\nDisagreements:\n  ${disagreements.join('\n  ')}`);
console.log('\nIf agreement is low, trust your grades: read the disagreements and adjust the judge instructions in eval/run.ts, not the reviewer prompt.');
