import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { parseReply, parseRequest, suggestPlans } from './coach';
import worker, { type Env } from './index';

const reply = {
  plans: [
    { ifThen: 'If the 9am meeting with Alex ends, then I will write the three action items in my notes app.', why: 'Captures commitments while they are fresh.' },
    { ifThen: 'If I sit down at my desk after lunch, then I will start the report for five minutes.', why: 'Starting small beats waiting for motivation.' },
    { ifThen: 'If Alex asks for a deadline, then I will give a date I can keep and add it to my calendar.', why: 'Promises you can keep build reliability.' },
  ],
  needsSupport: false,
};

function fakeClient(text: string, stop = 'end_turn') {
  const create = vi.fn().mockResolvedValue({ stop_reason: stop, content: [{ type: 'text', text }] });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe('coach', () => {
  it('validates requests', () => {
    expect(parseRequest({ goal: 'C', situation: '  meeting with Alex tomorrow  ' })).toEqual({ goal: 'C', situation: 'meeting with Alex tomorrow' });
    expect(() => parseRequest({ goal: 'E', situation: 'x y z' })).toThrow(/goal/);
    expect(() => parseRequest({ goal: 'A', situation: 'x'.repeat(401) })).toThrow(/400/);
    expect(() => parseRequest(null)).toThrow();
  });

  it('accepts the chosen challenge and current plan', () => {
    const challenge = { title: 'Two-minute start', instructions: 'Start the task you are avoiding for two minutes.' };
    expect(parseRequest({ goal: 'C', situation: 'report due Friday', challenge, plan: ' If I sit down, then I will open it. ' })).toEqual({
      goal: 'C',
      situation: 'report due Friday',
      challenge,
      plan: 'If I sit down, then I will open it.',
    });
    expect(() => parseRequest({ goal: 'C', situation: 'report due', challenge: { title: 'x' } })).toThrow(/challenge/);
    expect(() => parseRequest({ goal: 'C', situation: 'report due', plan: 5 })).toThrow(/plan/);
  });

  it('accepts plans in other languages', () => {
    const es = { plans: [{ ifThen: 'Si termino de cenar, entonces escribiré la primera frase del informe.', why: 'Empezar pequeño.' }], needsSupport: false };
    expect(parseReply(JSON.stringify(es)).plans).toHaveLength(1);
  });

  it('keeps only well-formed if-then plans', () => {
    const r = parseReply(JSON.stringify({ plans: [...reply.plans, { ifThen: 'Be nicer.', why: 'x' }], needsSupport: false }));
    expect(r.plans).toHaveLength(3);
    expect(() => parseReply(JSON.stringify({ plans: [{ ifThen: 'Be nicer.', why: 'x' }], needsSupport: false }))).toThrow();
  });

  it('asks the model for structured output with fallbacks, and keeps the situation as data', async () => {
    const { client, create } = fakeClient(JSON.stringify(reply));
    const out = await suggestPlans(client, { goal: 'C', situation: 'meeting with Alex at 9' });
    expect(out.plans).toHaveLength(3);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-opus-5-5');
    expect(args.fallbacks).toBe('default');
    expect(args.betas).toContain('server-side-fallback-2026-07-01');
    expect(args.output_config.format.type).toBe('json_schema');
    expect(args.messages[0].content).toContain('<situation>\nmeeting with Alex at 9\n</situation>');
  });

  it('tells the model which challenge the plans are for', async () => {
    const { client, create } = fakeClient(JSON.stringify(reply));
    await suggestPlans(client, {
      goal: 'C',
      situation: 'report due Friday',
      challenge: { title: 'Two-minute start', instructions: 'Start for two minutes.' },
      plan: 'If I sit down, then I will open it.',
    });
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content).toContain('<challenge>\nTwo-minute start: Start for two minutes.\n</challenge>');
    expect(content).toContain('<current_plan>\nIf I sit down, then I will open it.\n</current_plan>');
  });

  it('treats a refusal as an error', async () => {
    const { client } = fakeClient('', 'refusal');
    await expect(suggestPlans(client, { goal: 'A', situation: 'dinner with my sister' })).rejects.toThrow(/declined/);
  });
});

describe('worker', () => {
  const env: Env = { ANTHROPIC_API_KEY: 'test', ALLOWED_ORIGINS: 'https://justin-karlin.github.io' };
  const req = (init: RequestInit & { origin?: string }, path = '/coach') =>
    new Request(`https://coach.example${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.origin ? { Origin: init.origin } : {}) } });

  it('answers preflight only for the app', async () => {
    const ok = await worker.fetch(req({ method: 'OPTIONS', origin: 'https://justin-karlin.github.io' }), env);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://justin-karlin.github.io');
    const bad = await worker.fetch(req({ method: 'OPTIONS', origin: 'https://evil.example' }), env);
    expect(bad.status).toBe(403);
  });

  it('rejects other origins, bad input and rate-limited callers before calling Claude', async () => {
    expect((await worker.fetch(req({ method: 'POST', origin: 'https://evil.example', body: '{}' }), env)).status).toBe(403);
    expect((await worker.fetch(req({ method: 'POST', origin: 'https://justin-karlin.github.io', body: '{"goal":"X"}' }), env)).status).toBe(400);
    const limited = { ...env, LIMITER: { limit: async () => ({ success: false }) } };
    expect((await worker.fetch(req({ method: 'POST', origin: 'https://justin-karlin.github.io', body: '{}' }), limited)).status).toBe(429);
    expect((await worker.fetch(req({ method: 'GET' }, '/other'), env)).status).toBe(404);
  });
});
