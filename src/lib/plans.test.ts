import { describe, expect, it } from 'vitest';
import { joinIfThen, planHint, splitIfThen } from './plans';
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

describe('if-then template', () => {
  it('builds a plan sentence from a cue and an action', () => {
    expect(joinIfThen('I put my breakfast dishes away', 'open the document')).toBe(
      'If I put my breakfast dishes away, then I will open the document.',
    );
    expect(joinIfThen('after lunch,', "I'll write one rough sentence.")).toBe('After lunch, I will write one rough sentence.');
    expect(joinIfThen('when I sit down', '')).toBe('');
  });
  it('splits plans back into cue and action, and round-trips', () => {
    expect(splitIfThen("If it's 9am and I've opened my laptop, then I'll do 10 minutes on the report.")).toEqual({
      cue: "it's 9am and I've opened my laptop",
      action: 'do 10 minutes on the report',
    });
    expect(splitIfThen('When I get home, I will put my keys in the bowl.')).toEqual({
      cue: 'When I get home',
      action: 'put my keys in the bowl',
    });
    expect(splitIfThen('Be more organised')).toBeNull();
    const parts = splitIfThen('If I close my laptop, then I will write tomorrow’s first task.')!;
    expect(joinIfThen(parts.cue, parts.action)).toBe('If I close my laptop, then I will write tomorrow’s first task.');
  });
  it('splits most built-in examples', () => {
    const split = CHALLENGES.filter((c) => splitIfThen(c.ifThenExample)).length;
    expect(split / CHALLENGES.length).toBeGreaterThan(0.8);
  });
});
