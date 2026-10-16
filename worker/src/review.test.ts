import { describe, expect, it, vi } from 'vitest';
import { REVIEW_SYSTEM, checkReview, countsInWords, missedShortfall, parseReviewRequest, reviewMessage, reviewWeek, trimToSentences, type ReviewPlan } from './review';
import { WARNING_SIGNS } from './coach';
import { ladderFrom, routePlan } from './models';
import Anthropic from '@anthropic-ai/sdk';
import { coachPlan, reviewPlan } from './index';

const week = {
  goal: 'C',
  problem: 'Starting the quarterly report',
  daysSoFar: 7,
  plans: [
    {
      id: 'c-tomorrow',
      title: "Plan tomorrow's most important task",
      instructions: 'Each evening, choose one task and write when you will start it.',
      ifThen: 'If it is after lunch, then I will write my top task.',
      target: 5,
      done: 1,
      partly: 0,
      skipped: 0,
      noChance: 4,
      noEntry: 2,
    },
  ],
  reflection: { obstacles: 'Lunch is never at the same time.' },
};
const req = parseReviewRequest(week);
/** The same plan, short of its target because the person skipped the days they had the chance. */
const skippedWeek = { ...week, plans: [{ ...week.plans[0], skipped: 4, noChance: 0 }] };
const skipReq = parseReviewRequest(skippedWeek);

const good = {
  summary: 'You did it once; on four days the cue never came up.',
  changes: [
    { planId: 'c-tomorrow', kind: 'adjust', ifThen: 'When I close my laptop at 5pm, then I will write my top task.', target: 3, why: 'Lunch varies, so the cue rarely happened.' },
  ],
  needsSupport: false,
  escalate: false,
};

function reply(o: unknown, stop = 'end_turn') {
  return { stop_reason: stop, content: [{ type: 'text', text: JSON.stringify(o) }], usage: { input_tokens: 1, output_tokens: 1 } };
}
function fakeClient(...replies: unknown[]) {
  const create = vi.fn();
  for (const r of replies) {
    if (r instanceof Promise) create.mockReturnValueOnce(r.catch((e) => Promise.reject(e)));
    else create.mockResolvedValueOnce(r);
  }
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe('review request', () => {
  it('validates and keeps the week as data', () => {
    expect(req.plans[0].noChance).toBe(4);
    expect(req.depth).toBe('standard');
    expect(() => parseReviewRequest({ ...week, plans: [] })).toThrow(/plans/);
    expect(() => parseReviewRequest({ ...week, plans: [{ ...week.plans[0], done: 9 }] })).toThrow(/done/);
    const msg = reviewMessage(req);
    expect(msg.startsWith('<week>')).toBe(true);
    expect(msg).toContain('no chance 4');
    expect(msg).toContain('Lunch is never at the same time.');
  });
});

describe('counts and length', () => {
  it('spells out counts so the reviewer can quote them', () => {
    expect(countsInWords(req.plans[0], 7)).toBe(
      'In 7 days so far: done on 1 day, no chance came up on 4 days and nothing logged on 2 days; done on every day they logged having the chance. Target: 5 days a week (below the target, but only because of days with no chance or nothing logged).',
    );
    expect(reviewMessage(req)).toContain('In words (quote this rather than counting yourself): In 7 days so far: done on 1 day');
  });
  it('judges follow-through against the days they had the chance', () => {
    const plan = (o: Partial<ReviewPlan>): ReviewPlan => ({ ...req.plans[0], done: 0, partly: 0, skipped: 0, noChance: 0, noEntry: 0, ...o });
    // A real shortfall: chances skipped.
    expect(countsInWords(skipReq.plans[0], 7)).toBe(
      'In 7 days so far: done on 1 day, had the chance but skipped it on 4 days and nothing logged on 2 days; done on 1 of the 5 days they had the chance. Target: 5 days a week (below the target).',
    );
    // Mostly unlogged, but every logged day done.
    expect(countsInWords(plan({ done: 2, noEntry: 5 }), 7)).toBe(
      'In 7 days so far: done on 2 days and nothing logged on 5 days; done on every day they logged having the chance. Target: 5 days a week (below the target, but only because of days with no chance or nothing logged).',
    );
    // Target met, every chance taken.
    expect(countsInWords(plan({ done: 5, noChance: 2 }), 7)).toBe(
      'In 7 days so far: done on 5 days and no chance came up on 2 days; did it every time the chance came up. Target: 5 days a week (target met).',
    );
    expect(countsInWords(plan({ skipped: 1, noChance: 2, noEntry: 4, target: 3 }), 7)).toBe(
      'In 7 days so far: done on 0 days, had the chance but skipped it on 1 day, no chance came up on 2 days and nothing logged on 4 days; not done on the one day they had the chance. Target: 3 days a week (below the target).',
    );
    // No chance at all: nothing to claim about follow-through.
    expect(countsInWords(plan({ noChance: 7 }), 7)).toBe(
      'In 7 days so far: done on 0 days and no chance came up on 7 days. Target: 5 days a week (below the target, but only because of days with no chance or nothing logged).',
    );
    // Early in the week, the shortfall isn't put down to no-chance or unlogged days.
    expect(countsInWords(plan({ done: 2, noChance: 1 }), 3)).toBe(
      'In 3 days so far: done on 2 days and no chance came up on 1 day; did it every time the chance came up. Target: 5 days a week (below the target).',
    );
  });
  it('trims long summaries to whole sentences instead of failing', () => {
    const long = 'First sentence is here. '.repeat(40);
    const out = trimToSentences(long, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith('here.')).toBe(true);
    expect(checkReview(JSON.stringify({ ...good, summary: long }), req).summary.length).toBeLessThanOrEqual(700);
  });
});

describe('checkReview', () => {
  it('accepts a grounded reply', () => {
    const change = checkReview(JSON.stringify(good), req).changes[0];
    expect(change).toMatchObject({ kind: 'adjust', target: 3 });
    expect(change.ifThen).toMatch(/^When I close/);
    // "" and 0 mean "unchanged" and are left out; plans in other languages are fine.
    const spanish = { ...good.changes[0], ifThen: 'Cuando cierre el portátil a las 5, escribiré mi tarea principal.', target: 0 };
    expect(checkReview(JSON.stringify({ ...good, changes: [spanish] }), req).changes[0]).not.toHaveProperty('target');
    const targetOnly = checkReview(JSON.stringify({ ...good, changes: [{ ...good.changes[0], ifThen: '' }] }), req).changes[0];
    expect(targetOnly).not.toHaveProperty('ifThen');
    expect(checkReview(JSON.stringify({ ...good, changes: [] }), req).changes).toEqual([]);
  });
  it('rejects replies that would mislead the person', () => {
    const bad = (changes: unknown[]) => () => checkReview(JSON.stringify({ ...good, changes }), req);
    expect(bad([{ ...good.changes[0], planId: 'c-other' }])).toThrow(/unknown plan/);
    expect(bad([{ ...good.changes[0], ifThen: 'Be tidier.', target: 0 }])).toThrow(/too short/);
    expect(bad([{ ...good.changes[0], ifThen: '', target: 5 }])).toThrow(/changes nothing/);
    expect(bad([{ ...good.changes[0], target: 9 }])).toThrow(/1–7/);
    expect(bad([good.changes[0], good.changes[0], good.changes[0]])).toThrow(/two/);
    expect(() => checkReview('not json', req)).toThrow(/JSON/);
  });
});

describe('missedShortfall', () => {
  const unchanged = { summary: 'x', changes: [], needsSupport: false };
  const withPlan = (o: Partial<ReviewPlan>, daysSoFar = 7) =>
    parseReviewRequest({ ...week, daysSoFar, plans: [{ ...week.plans[0], done: 0, partly: 0, skipped: 0, noChance: 0, noEntry: 0, ...o }] });

  it('flags a shortfall the record puts down to the person', () => {
    expect(missedShortfall(skipReq, unchanged)).toBe('c-tomorrow');
    expect(missedShortfall(withPlan({ done: 1, partly: 2, skipped: 1, noEntry: 3 }), unchanged)).toBe('c-tomorrow');
    expect(missedShortfall(withPlan({ skipped: 3, noChance: 4 }), unchanged)).toBe('c-tomorrow');
  });

  it('flags a cue that rarely came up, for a second opinion', () => {
    // done 1, no chance 4, nothing logged 2.
    expect(missedShortfall(req, unchanged)).toBe('c-tomorrow');
    expect(missedShortfall(withPlan({ done: 2, noChance: 5 }), unchanged)).toBe('c-tomorrow');
    expect(missedShortfall(withPlan({ done: 2, skipped: 1, noChance: 4 }), unchanged)).toBe('c-tomorrow');
  });

  it("doesn't flag a plan short only because of a couple of no-chance days", () => {
    expect(missedShortfall(withPlan({ done: 2, noChance: 2, noEntry: 3 }), unchanged)).toBeUndefined();
  });

  it("doesn't flag a plan short only because days weren't logged", () => {
    expect(missedShortfall(withPlan({ done: 2, noEntry: 5 }), unchanged)).toBeUndefined();
    expect(missedShortfall(withPlan({ done: 1, skipped: 1, noEntry: 5 }), unchanged)).toBeUndefined();
    // The old rule flagged this one (3 days logged, 3 < 7/2): every logged chance was taken.
    expect(missedShortfall(withPlan({ done: 3, noEntry: 4, target: 7 }), unchanged)).toBeUndefined();
  });

  it("doesn't flag a plan done on at least half its target days, even with some skips", () => {
    expect(missedShortfall(withPlan({ done: 2, partly: 2, skipped: 1, noEntry: 2, target: 3 }), unchanged)).toBeUndefined();
    expect(missedShortfall(withPlan({ done: 2, partly: 1, skipped: 2, noEntry: 2, target: 4 }), unchanged)).toBeUndefined();
  });

  it("doesn't flag a plan that met its target, was changed, too early, or a possible crisis", () => {
    expect(missedShortfall(withPlan({ done: 1, skipped: 4, noEntry: 2, target: 1 }), unchanged)).toBeUndefined();
    expect(missedShortfall(skipReq, { ...unchanged, changes: [{ planId: 'c-tomorrow', kind: 'adjust', target: 2, why: 'x' }] })).toBeUndefined();
    expect(missedShortfall(withPlan({ done: 1, skipped: 3 }, 4), unchanged)).toBeUndefined();
    expect(missedShortfall(skipReq, { ...unchanged, needsSupport: true })).toBeUndefined();
  });
});

describe('review prompt', () => {
  it('judges targets on the days they had the chance and includes the shared warning signs', () => {
    expect(REVIEW_SYSTEM).toContain('fewer than half the days they had the chance');
    expect(REVIEW_SYSTEM).toContain("Days with no chance or nothing logged don't show that a target is too high");
    expect(REVIEW_SYSTEM).not.toContain('fewer than half the target days');
    expect(REVIEW_SYSTEM).toContain(WARNING_SIGNS);
  });
});

describe('escalation', () => {
  const opts = { tiers: ladderFrom('haiku', 'opus') };

  it('answers on the first tier when it can, without fallbacks on Haiku', async () => {
    const { client, create } = fakeClient(reply(good));
    const out = await reviewWeek(client, req, opts);
    expect(out.tier).toBe('haiku');
    expect(out.escalations).toEqual([]);
    expect(create.mock.calls[0][0].model).toBe('claude-haiku-5-5');
    expect(create.mock.calls[0][0].fallbacks).toBeUndefined();
  });

  it('moves up on a refusal, an invalid reply, or when the model asks', async () => {
    const { client, create } = fakeClient(reply({}, 'refusal'), reply({ ...good, changes: [{ ...good.changes[0], planId: 'x' }] }), reply(good));
    const out = await reviewWeek(client, req, opts);
    expect(out.tier).toBe('opus');
    expect(out.escalations.map((e) => e.reason)).toEqual(['refusal', 'invalid']);
    expect(create.mock.calls[1][0].fallbacks).toBe('default');

    const asked = fakeClient(reply({ ...good, escalate: true }), reply(good));
    expect((await reviewWeek(asked.client, req, opts)).escalations).toEqual([{ tier: 'haiku', reason: 'model-asked' }]);
  });

  it('lets the largest model write any reply that may involve a crisis', async () => {
    const support = { ...good, changes: [], needsSupport: true };
    const { client } = fakeClient(reply(support), reply(support), reply(support));
    const out = await reviewWeek(client, req, opts);
    expect(out.tier).toBe('opus');
    expect(out.needsSupport).toBe(true);
  });

  it('escalates when a plan clearly fell short and the reply left it unchanged', async () => {
    // done 1 of the 5 days they had the chance: leaving it alone misses the point.
    const { client } = fakeClient(reply({ ...good, changes: [] }), reply(good));
    const out = await reviewWeek(client, skipReq, opts);
    expect(out.tier).toBe('sonnet');
    expect(out.escalations).toEqual([{ tier: 'haiku', reason: 'missed' }]);
    // Too early in the week: no rule-based escalation.
    const early = parseReviewRequest({ ...skippedWeek, daysSoFar: 3 });
    expect((await reviewWeek(fakeClient(reply({ ...good, changes: [] })).client, early, opts)).tier).toBe('haiku');
    // Short of target only because days weren't logged: leaving it alone is allowed.
    const unlogged = parseReviewRequest({ ...week, plans: [{ ...week.plans[0], done: 2, noChance: 0, noEntry: 5 }] });
    expect((await reviewWeek(fakeClient(reply({ ...good, changes: [] })).client, unlogged, opts)).tier).toBe('haiku');
    // A cue that rarely came up gets a second opinion, but the top tier may still leave it
    // alone (an unusual week): the check never forces a change.
    const keep = reply({ ...good, changes: [] });
    const secondOpinion = await reviewWeek(fakeClient(keep, keep, keep).client, req, opts);
    expect(secondOpinion.tier).toBe('opus');
    expect(secondOpinion.changes).toEqual([]);
  });

  it("accepts the last tier's answer even if it asks to escalate, and fails if it refuses", async () => {
    const last = fakeClient(reply({ ...good, escalate: true }));
    expect((await reviewWeek(last.client, req, { tiers: ['opus'] })).tier).toBe('opus');
    const refused = fakeClient(reply({}, 'refusal'));
    await expect(reviewWeek(refused.client, req, { tiers: ['opus'] })).rejects.toThrow(/declined/);
  });
});

describe('outages', () => {
  const overloaded = () => new Anthropic.InternalServerError(529, undefined, 'Overloaded', new Headers());
  const opts = { tiers: ladderFrom('sonnet', 'opus'), spare: ['haiku' as const] };

  it('moves to another model when one is overloaded', async () => {
    const { client } = fakeClient(Promise.reject(overloaded()), reply(good));
    const out = await reviewWeek(client, req, opts);
    expect(out.tier).toBe('opus');
    expect(out.escalations).toEqual([{ tier: 'sonnet', reason: 'error' }]);
  });

  it('falls back to a smaller model when every model on the ladder is down', async () => {
    const { client } = fakeClient(Promise.reject(overloaded()), Promise.reject(overloaded()), reply(good));
    expect((await reviewWeek(client, req, opts)).tier).toBe('haiku');
  });

  it("doesn't retry a malformed request on other models", async () => {
    const bad = new Anthropic.BadRequestError(400, undefined, 'Bad request', new Headers());
    const { client, create } = fakeClient(Promise.reject(bad));
    await expect(reviewWeek(client, req, opts)).rejects.toThrow(/Bad request/);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('model settings', () => {
  const env = { ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: '' };
  it('start on Haiku and escalate to Opus; a deeper review starts one tier up', () => {
    expect(reviewPlan(env, 'standard')).toEqual({ tiers: ['haiku', 'sonnet', 'opus'], spare: [] });
    expect(reviewPlan(env, 'deeper')).toEqual({ tiers: ['sonnet', 'opus'], spare: ['haiku'] });
    expect(reviewPlan({ ...env, REVIEW_MODEL: 'sonnet', REVIEW_MAX_MODEL: 'sonnet' }, 'standard')).toEqual({ tiers: ['sonnet'], spare: ['haiku'] });
    expect(reviewPlan({ ...env, REVIEW_MODEL: 'nonsense' }, 'standard').tiers[0]).toBe('haiku');
    expect(coachPlan({ ...env, COACH_MODEL: 'opus' })).toEqual({ tiers: ['opus'], spare: ['sonnet', 'haiku'] });
  });
});


describe('cost and crisis safeguards', () => {
  const week2 = parseReviewRequest(week);
  const opts = { tiers: ladderFrom('haiku', 'opus') };
  const supportReply = { ...good, changes: [], needsSupport: true };

  it('sends a possible crisis straight to the largest model, skipping the middle tier', async () => {
    const { client, create } = fakeClient(reply(supportReply), reply(supportReply));
    const out = await reviewWeek(client, week2, opts);
    expect(out.tier).toBe('opus');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
  });

  it("doesn't move to a bigger model when our own rate limit is hit", async () => {
    const limited = new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers());
    const { client, create } = fakeClient(Promise.reject(limited));
    await expect(reviewWeek(client, week2, opts)).rejects.toThrow(/Rate limited/);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('capped ladder (spend breaker cheap mode)', () => {
  const capped = { tiers: ['haiku' as const], crisisTier: 'opus' as const };
  const supportReply = { ...good, changes: [], needsSupport: true };

  it('sends only a possible crisis past the cap, to the crisis tier', async () => {
    const { client, create } = fakeClient(reply(supportReply), reply(supportReply));
    const out = await reviewWeek(client, req, capped);
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(out).toMatchObject({ tier: 'opus', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'support' }] });
    // So does a week Haiku flagged as beyond it, or refused (it has no server-side fallback).
    const asked = fakeClient(reply({ ...good, escalate: true }), reply(good));
    expect(await reviewWeek(asked.client, req, capped)).toMatchObject({ tier: 'opus', escalations: [{ tier: 'haiku', reason: 'model-asked' }] });
    const refused = fakeClient(reply({}, 'refusal'), reply(supportReply));
    expect(await reviewWeek(refused.client, req, capped)).toMatchObject({ tier: 'opus', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'refusal' }] });
    // A refusal the crisis tier can't take stays a refusal.
    const denied = fakeClient(reply({}, 'refusal'));
    await expect(reviewWeek(denied.client, req, { ...capped, allowCrisis: async () => false })).rejects.toMatchObject({ reason: 'refusal' });
    // Anything else is answered on the capped tier.
    const plain = fakeClient(reply(good));
    expect((await reviewWeek(plain.client, req, capped)).tier).toBe('haiku');
    expect(plain.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the smaller model's support reply when the crisis call fails in any way", async () => {
    const limited = new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers());
    const bad = new Anthropic.BadRequestError(400, undefined, 'Bad request', new Headers());
    for (const err of [limited, bad]) {
      const { client } = fakeClient(reply(supportReply), Promise.reject(err));
      const out = await reviewWeek(client, req, capped);
      expect(out).toMatchObject({ tier: 'haiku', needsSupport: true });
      expect(out.escalations).toEqual([{ tier: 'haiku', reason: 'support' }, { tier: 'opus', reason: 'error' }]);
    }
    // A programming error still surfaces.
    const { client } = fakeClient(reply(supportReply), Promise.reject(new TypeError('bug')));
    await expect(reviewWeek(client, req, capped)).rejects.toThrow('bug');
  });

  it("keeps the smaller model's support reply when the reserve is used up or the top tier fails", async () => {
    const denied = fakeClient(reply(supportReply));
    const out = await reviewWeek(denied.client, req, { ...capped, allowCrisis: async () => false });
    expect(out).toMatchObject({ tier: 'haiku', needsSupport: true, escalations: [] });
    expect(denied.create).toHaveBeenCalledTimes(1);

    const overloaded = new Anthropic.InternalServerError(529, undefined, 'Overloaded', new Headers());
    const down = fakeClient(reply(supportReply), Promise.reject(overloaded));
    const kept = await reviewWeek(down.client, req, capped);
    expect(kept).toMatchObject({ tier: 'haiku', needsSupport: true });
    expect(kept.escalations).toEqual([{ tier: 'haiku', reason: 'support' }, { tier: 'opus', reason: 'error' }]);
  });

  it('reports the cost of every response, including escalated ones', async () => {
    const seen: string[] = [];
    const { client } = fakeClient(reply({}, 'refusal'), reply(good));
    await reviewWeek(client, req, { tiers: ladderFrom('haiku', 'opus') }, (tier) => seen.push(tier));
    expect(seen).toEqual(['haiku', 'sonnet']);
  });
});

describe('full ladder: a possible crisis is never lost to a failing top tier', () => {
  const supportReply = { ...good, changes: [], needsSupport: true };
  const full = { tiers: ladderFrom('haiku', 'opus') };

  it("returns the smaller model's support reply when the top tier is cut off, refuses, is down or rate-limited", async () => {
    const failures = [
      reply(supportReply, 'max_tokens'),
      reply({}, 'refusal'),
      Promise.reject(new Anthropic.InternalServerError(529, undefined, 'Overloaded', new Headers())),
      Promise.reject(new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers())),
    ];
    for (const failure of failures) {
      const attempts: unknown[] = [];
      const { client, create } = fakeClient(reply(supportReply), failure);
      const out = await reviewWeek(client, req, { ...full, attempts: attempts as never });
      expect(create.mock.calls.map((c) => c[0].model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
      expect(out).toMatchObject({ tier: 'haiku', needsSupport: true });
      expect(out.escalations[0]).toEqual({ tier: 'haiku', reason: 'support' });
      expect(out.escalations).toHaveLength(2);
    }
  });

  it('keeps the support reply when the top tier is down and a smaller spare model answers', async () => {
    // A "deeper" review, or REVIEW_MODEL=sonnet: Sonnet first, Haiku spare.
    const overloaded = new Anthropic.InternalServerError(529, undefined, 'Overloaded', new Headers());
    const { client, create } = fakeClient(reply(supportReply), Promise.reject(overloaded), reply(good));
    const out = await reviewWeek(client, req, routePlan('sonnet', 'opus'));
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']);
    expect(out).toMatchObject({ tier: 'sonnet', needsSupport: true, changes: [] });
    expect(out.escalations).toEqual([{ tier: 'sonnet', reason: 'support' }, { tier: 'opus', reason: 'error' }]);
  });

  it('keeps a reply that flags support but fails the checks, without its changes', async () => {
    const badChange = { ...supportReply, summary: 'This sounds frightening.', changes: [{ planId: 'nope', kind: 'drop', ifThen: '', target: 0, why: 'x' }] };
    const { client } = fakeClient(reply(badChange), reply({}, 'refusal'), reply({}, 'refusal'));
    const out = await reviewWeek(client, req, full);
    expect(out).toMatchObject({ tier: 'haiku', needsSupport: true, changes: [], summary: 'This sounds frightening.' });
  });

  it('still fails when no reply flagged support', async () => {
    const { client } = fakeClient(reply({}, 'refusal'), reply({}, 'refusal'), reply({}, 'refusal'));
    await expect(reviewWeek(client, req, full)).rejects.toMatchObject({ reason: 'refusal' });
  });
});
