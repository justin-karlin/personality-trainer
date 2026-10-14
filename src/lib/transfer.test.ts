import { describe, expect, it } from 'vitest';
import { makeTransferCode, readTransferCode } from './transfer';
import { emptyState } from './storage';

describe('transfer codes', () => {
  it('round-trips the whole state', async () => {
    const state = { ...emptyState(), acceptedDisclaimer: true, checkins: { '2026-10-01': { date: '2026-10-01', states: { C: 4 }, mood: 3 } } } as ReturnType<typeof emptyState>;
    const code = await makeTransferCode(state);
    expect(code.startsWith('TT1.')).toBe(true);
    expect(await readTransferCode(`  ${code}\n`)).toEqual({ ...state, observerRatings: [] });
  });

  it('rejects text that is not a code, or a truncated one', async () => {
    await expect(readTransferCode('hello')).rejects.toThrow(/transfer code/);
    const code = await makeTransferCode(emptyState());
    await expect(readTransferCode(code.slice(0, code.length - 6))).rejects.toThrow();
  });
});
