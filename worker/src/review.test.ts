import { describe, expect, it, vi } from 'vitest';
import { checkReview, parseReviewRequest, reviewMessage, reviewWeek } from './review';
import { ladderFrom } from './models';
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

const good = {
  summary: 'You did it once; on four days the cue never came up.',
  changes: [
    { planId: 'c-tomorrow', kind: 'reword', ifThen: 'When I close my laptop at 5pm, then I will write my top task.', target: 0, why: 'Lunch varies, so the cue rarely happened.' },
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

describe('checkReview', () => {
  it('accepts a grounded reply', () => {
    expect(checkReview(JSON.stringify(good), req).changes[0].kind).toBe('reword');
    expect(checkReview(JSON.stringify({ ...good, changes: [] }), req).changes).toEqual([]);
  });
  it('rejects replies that would mislead the person', () => {
    const bad = (changes: unknown[]) => () => checkReview(JSON.stringify({ ...good, changes }), req);
    expect(bad([{ ...good.changes[0], planId: 'c-other' }])).toThrow(/unknown plan/);
    expect(bad([{ ...good.changes[0], ifThen: 'Be more organised.' }])).toThrow(/if-then/);
    expect(bad([{ ...good.changes[0], kind: 'target', target: 5 }])).toThrow(/unchanged/);
    expect(bad([good.changes[0], good.changes[0], good.changes[0]])).toThrow(/two/);
    expect(() => checkReview('not json', req)).toThrow(/JSON/);
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

