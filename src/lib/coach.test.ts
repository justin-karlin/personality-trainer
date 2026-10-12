import { describe, expect, it } from 'vitest';
import type { AppState, Commitment } from '../types';
import { emptyState } from './storage';
import { coachTips } from './coach';

const start = '2026-03-02';
const base: AppState = {
  ...emptyState(),
  acceptedDisclaimer: true,
  startDate: start,
  assessments: [{ id: 'a', date: start, answers: {}, scores: { N: 3, E: 3, O: 3, A: 3, C: 3 } }],
  goals: [{ trait: 'C', why: 'w', vision: 'v', createdAt: start }],
};

function withWeek(commitments: Commitment[], weekIndex = 0): AppState {
  return { ...base, weeks: [{ weekIndex, startDate: start, commitments }] };
}

const c = (challengeId: string, target: number, completions: string[]): Commitment => ({
  challengeId,
  ifThen: 'If x, then y',
  confidence: 8,
  target,
  completions,
});

const ids = (s: AppState, date: string) => coachTips(s, date).map((t) => t.id);

describe('coachTips', () => {
  it('asks for a reflection when last week was not reflected on', () => {
    expect(ids(withWeek([c('c-reset', 3, [])]), '2026-03-09')).toContain('reflect');
  });

  it('celebrates a completed week', () => {
    const s = withWeek([c('c-reset', 2, ['2026-03-02', '2026-03-03'])]);
    expect(ids(s, '2026-03-04')[0]).toBe('done');
  });

  it('suggests shrinking challenges late in a weak week', () => {
    expect(ids(withWeek([c('c-reset', 5, [])]), '2026-03-07')).toContain('behind');
  });

  it('reassures after a single missed day', () => {
    const s = withWeek([c('c-reset', 5, ['2026-03-02'])]);
    expect(ids(s, '2026-03-04')).toContain('missed');
  });

  it('prompts a check-in until one is logged', () => {
    const s = withWeek([c('c-reset', 5, [])]);
    expect(ids(s, '2026-03-03')).toContain('checkin');
    const logged = { ...s, checkins: { '2026-03-03': { date: '2026-03-03', states: { C: 4 } } } };
    expect(ids(logged, '2026-03-03')).not.toContain('checkin');
  });

  it('puts sustained low mood first', () => {
    const s: AppState = {
      ...withWeek([c('c-reset', 5, [])]),
      checkins: {
        '2026-03-03': { date: '2026-03-03', states: {}, mood: 1 },
        '2026-03-04': { date: '2026-03-04', states: {}, mood: 2 },
      },
    };
    expect(ids(s, '2026-03-04')[0]).toBe('low-mood');
  });

  it('shows the well-being nudge for two weeks after a positive screen', () => {
    const s: AppState = {
      ...base,
      assessments: [{ ...base.assessments[0], wellbeing: { anxiety: 4, depression: 1 } }],
    };
    expect(ids(s, '2026-03-10')).toContain('support');
    expect(ids(s, '2026-03-20')).not.toContain('support');
  });

  it('recommends recharge time only around bigger social challenges', () => {
    expect(ids(withWeek([c('e-hello-plus', 5, [])]), '2026-03-03')).not.toContain('recharge');
    expect(ids(withWeek([c('e-host', 1, [])]), '2026-03-03')).toContain('recharge');
  });

  it('recommends recharge time to introverted users for any social challenge', () => {
    const introvert: AppState = {
      ...withWeek([c('e-hello-plus', 5, [])]),
      assessments: [{ ...base.assessments[0], scores: { N: 3, E: 2.1, O: 3, A: 3, C: 3 } }],
    };
    expect(ids(introvert, '2026-03-03')).toContain('recharge');
  });

  it('prompts a retake after four weeks', () => {
    expect(ids(base, '2026-03-30')).toContain('reassess');
    expect(ids(base, '2026-03-20')).not.toContain('reassess');
  });

  it('offers follow-through support early on to people lower in conscientiousness', () => {
    const lowC: AppState = {
      ...withWeek([c('c-reset', 3, [])]),
      assessments: [{ ...base.assessments[0], scores: { N: 3, E: 3, O: 3, A: 3, C: 2.5 } }],
    };
    expect(ids(lowC, '2026-03-03')).toContain('follow-through');
    expect(ids(withWeek([c('c-reset', 3, [])]), '2026-03-03')).not.toContain('follow-through');
    expect(ids({ ...lowC, weeks: [{ weekIndex: 4, startDate: '2026-03-30', commitments: [] }] }, '2026-03-31')).not.toContain('follow-through');
  });

  it('suggests a second trait early in consolidation, after a strong week', () => {
    const strong = c('c-reset', 2, ['2026-04-20', '2026-04-21']);
    const afterStrong = withWeek([strong], 7); // week 8 fully done
    expect(ids(afterStrong, '2026-05-01')).toContain('second-goal'); // first week of consolidation
    expect(ids(afterStrong, '2026-03-10')).not.toContain('second-goal');
    expect(ids(afterStrong, '2026-05-15')).not.toContain('second-goal'); // third week of consolidation
    expect(ids(withWeek([c('c-reset', 2, ['2026-04-20'])], 7), '2026-05-01')).not.toContain('second-goal');
    expect(ids(base, '2026-05-01')).not.toContain('second-goal'); // nothing planned yet
  });
  it('drops the follow-through tip when the week is going well', () => {
    const lowC = { ...base.assessments[0], scores: { N: 3, E: 3, O: 3, A: 3, C: 2.5 } };
    const done = { ...withWeek([c('c-reset', 1, ['2026-03-02'])]), assessments: [lowC] };
    expect(ids(done, '2026-03-03')).not.toContain('follow-through');
  });
});
