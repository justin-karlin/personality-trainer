import { describe, expect, it } from 'vitest';
import { decodeReply, decodeRequest, encodeReply, encodeRequest, observerScore, toObserverRating, ratersFor } from './observer';

describe('friend ratings', () => {
  it('round-trips a request, also from inside a whole link', () => {
    const code = encodeRequest({ id: 'abc', name: 'Sam', traits: ['C', 'A'] });
    expect(decodeRequest(`https://x.io/app/#/rate?d=${code}`)).toEqual({ id: 'abc', name: 'Sam', traits: ['C', 'A'] });
  });

  it('round-trips a reply and scores it with reverse keys', () => {
    const answers = { C: [5, 1, 5, 1, 5, 1, 5, 1, 5, 5] };
    const code = encodeReply({ requestId: 'abc', relation: 'Partner', date: '2026-10-14', answers, change: { C: 1 } });
    const reply = decodeReply(`My rating for you: https://x.io/#/rated?d=${code}`);
    expect(reply.answers).toEqual(answers);
    expect(observerScore('C', answers.C)).toBe(5);
    const r = toObserverRating(reply);
    expect(r.scores.C).toBe(5);
    expect(r.change.C).toBe(1);
  });

  it('rejects tampered or incomplete replies', () => {
    const code = encodeReply({ requestId: 'abc', relation: 'Friend', date: '2026-10-14', answers: { C: [9, 1, 1, 1, 1, 1, 1, 1, 1, 1] }, change: {} });
    expect(() => decodeReply(code)).toThrow();
    expect(() => decodeReply('hello')).toThrow(/rating reply/);
    expect(() => decodeRequest('TR1.@@@')).toThrow();
  });
});

describe('ratersFor', () => {
  const rating = (id: string, requestId: string, date: string, c: number, change = 0) => ({
    id,
    requestId,
    date,
    relation: 'Friend',
    scores: { C: c },
    change: { C: change },
  });
  it('compares only ratings from the same person, using the first as the baseline', () => {
    const requests = [
      { id: 'q1', label: 'Sam', date: '2026-01-01' },
      { id: 'q2', label: 'sam ', date: '2026-03-01' },
      { id: 'q3', label: 'Alex', date: '2026-03-01' },
    ];
    const rows = ratersFor('C', [rating('r2', 'q2', '2026-03-02', 3.6, 1), rating('r1', 'q1', '2026-01-02', 3.1), rating('r3', 'q3', '2026-03-03', 4.2)], requests);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ who: 'Sam', count: 2, first: { score: 3.1 }, latest: { score: 3.6 }, impression: 1 });
    expect(rows[1]).toMatchObject({ who: 'Alex', count: 1 });
  });
  it('keeps unlabelled replies separate', () => {
    expect(ratersFor('C', [rating('a', 'x', '2026-01-01', 3), rating('b', 'y', '2026-02-01', 4)])).toHaveLength(2);
  });
});
