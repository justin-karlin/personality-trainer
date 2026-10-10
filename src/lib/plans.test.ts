import { describe, expect, it } from 'vitest';
import { planHint } from './plans';
import { CHALLENGES } from '../data/challenges';

describe('planHint', () => {
  it('accepts concrete if-then plans, including every built-in example', () => {
    expect(planHint("If it's 8am and I've poured my coffee, then I'll write my top task.")).toBeNull();
    expect(planHint('When I get home from work, I will put my keys in the bowl.')).toBeNull();
    for (const c of CHALLENGES) expect(planHint(c.ifThenExample), c.id).toBeNull();
  });
  it('flags plans that are too short, have no cue, no action, or only a trait word', () => {
    expect(planHint('be nicer')).toMatch(/detail/);
    expect(planHint('I will talk to more people at work every day')).toMatch(/cue/);
    expect(planHint('If I am at the office on Tuesday morning, coffee')).toMatch(/action/);
    expect(planHint('When I am at a party, then I will be more outgoing')).toMatch(/concrete step/);
  });
  it('ignores empty text', () => {
    expect(planHint('   ')).toBeNull();
  });
});
