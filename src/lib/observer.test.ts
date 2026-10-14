import { describe, expect, it } from 'vitest';
import { decodeReply, decodeRequest, encodeReply, encodeRequest, observerScore, toObserverRating } from './observer';

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
