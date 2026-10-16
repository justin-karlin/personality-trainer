import type { AppState } from '../types';
import { addDays, daysBetween } from './dates';
import { suggestsSupport } from './scoring';
import { challengeById } from '../data/challenges';
import { currentStage, goalWeek, primaryGoal, stageStarts } from './path';
import { hasCheckinData } from './checkin';
import { completionRate, currentWeekIndex, findWeek, isReassessmentDue, previousPlannedWeek, weekStart } from './program';

export interface Tip {
  id: string;
  tone: 'info' | 'success' | 'warn' | 'care';
  title: string;
  /** One short, actionable sentence shown with the title when the body is collapsed. */
  lead?: string;
  body: string;
  refs?: string[];
  action?: { label: string; route: string };
}

const LOW_MOOD = 2;
/** IPIP-50 extraversion mean at or below which we treat someone as introverted (about the 25th percentile). */
const INTROVERTED_E = 2.4;
/** IPIP-50 conscientiousness mean at or below which follow-through support is offered (about the 24th percentile in the app's norms). */
export const LOW_C = 2.8;

/**
 * Rule-based coaching messages for the dashboard, most important first.
 * Each rule is grounded in a specific finding so the advice stays honest.
 */
export function coachTips(state: AppState, date: string): Tip[] {
  const tips: Tip[] = [];
  const idx = currentWeekIndex(state, date);
  if (idx == null) return tips;

  // Safety first: sustained low mood gets a gentle pointer to real support.
  const recentMoods = [0, 1, 2]
    .map((d) => state.checkins[addDays(date, -d)]?.mood)
    .filter((m): m is number => m != null);
  if (recentMoods.length >= 2 && recentMoods.every((m) => m <= LOW_MOOD)) {
    tips.push({
      id: 'low-mood',
      tone: 'care',
      title: 'Your mood has been low',
      body:
        'If it lasts two weeks, see a doctor or therapist. Thoughts of self-harm? Call or text 988 (US) or visit findahelpline.com.',
      action: { label: 'Support resources', route: 'settings' },
    });
  }

  // Repeat the well-being nudge for two weeks after a screen that suggested support.
  const latest = state.assessments[state.assessments.length - 1];
  if (!tips.length && suggestsSupport(latest?.wellbeing) && daysBetween(latest.date, date) <= 14) {
    tips.push({
      id: 'support',
      tone: 'care',
      title: 'Extra support can help',
      body: 'Your last check showed strain. Consider a doctor or therapist.',
      refs: ['karyotaki2021'],
      action: { label: 'Support resources', route: 'settings' },
    });
  }

  const week = findWeek(state, idx);
  const prev = previousPlannedWeek(state, idx);

  // Coming back after a gap: welcome it rather than scold. Rewarding a return
  // after a missed workout was among the most effective tactics in a large
  // exercise megastudy (Milkman et al., 2021).
  const activeDays = new Set([
    ...Object.values(state.checkins).filter(hasCheckinData).map((c) => c.date),
    ...state.weeks.flatMap((w) => w.commitments.flatMap((c) => [...c.completions, ...Object.keys(c.log ?? {})])),
  ]);
  const lastActive = [...activeDays].filter((d) => d < date).sort().pop();
  // Only after a real lapse: three or more days without activity and this week's plan behind pace.
  const pace = week ? Math.min(1, daysBetween(weekStart(state, idx), date) / 7) : 0;
  const returned =
    lastActive != null && daysBetween(lastActive, date) >= 3 && (!week || completionRate(week) < pace);
  if (returned && !activeDays.has(date)) {
    tips.push({
      id: 'welcome-back',
      tone: 'success',
      title: 'Welcome back',
      lead: 'Do the smallest version of one challenge today.',
      body: 'Coming back after a break is the habit that matters most.',
      refs: ['milkman2021', 'lally2010'],
    });
  }

  if (prev && !prev.reflection && prev.weekIndex === idx - 1) {
    tips.push({
      id: 'reflect',
      tone: 'info',
      title: 'Look back on last week',
      body: 'A few minutes on what worked and what got in the way.',
      refs: ['stieger2021', 'stieger2024'],
      action: { label: 'Weekly reflection', route: 'reflect' },
    });
  }

  if (week) {
    const dayOfWeek = daysBetween(weekStart(state, idx), date); // 0..6
    const rate = completionRate(week);
    const yesterday = addDays(date, -1);
    const didYesterday = week.commitments.some((c) => c.completions.includes(yesterday));
    const openCommitments = week.commitments.some((c) => c.completions.length < c.target);

    if (rate >= 1) {
      tips.push({
        id: 'done',
        tone: 'success',
        title: 'Every target met',
        lead: 'Repeat what worked to make it a habit.',
        body: 'Finishing challenges went with more growth.',
        refs: ['hudson2019', 'lally2010'],
      });
    } else if (dayOfWeek >= 4 && rate < 0.4 && !returned) {
      tips.push({
        id: 'behind',
        tone: 'warn',
        title: 'Shrink it, don’t skip it',
        lead: 'Do the smallest version of one challenge today.',
        body: 'Next week, pick easier or fewer challenges.',
        refs: ['hudson2019'],
      });
    } else if (dayOfWeek > 0 && !didYesterday && openCommitments && !returned) {
      tips.push({
        id: 'missed',
        tone: 'info',
        title: 'Missed a day? Start again',
        lead: "Log it under “Not done?”, then watch for today's cue.",
        body: 'One miss doesn’t break a habit.',
        refs: ['lally2010'],
      });
    }

    if (!hasCheckinData(state.checkins[date])) {
      tips.push({
        id: 'checkin',
        tone: 'info',
        title: 'Log today\'s check-in',
        body: 'Tracking progress helps you reach a goal.',
        refs: ['harkin2016'],
      });
    }
  }

  // Less conscientious people were somewhat likelier to drop out of these
  // studies (they did not test whether it slows change in people who stay), so support
  // follow-through during the small-steps stage, unless the week is going well.
  const latestC = state.assessments[state.assessments.length - 1]?.scores.C;
  const stage = currentStage(state, date);
  if (latestC != null && latestC <= LOW_C && stage === 'small' && !(week && completionRate(week) >= 1)) {
    tips.push({
      id: 'follow-through',
      tone: 'info',
      title: 'Make sticking with it easy',
      lead: 'Keep this week light and set up the kit below.',
      body: 'A reminder, someone who checks in, and a plan for missed days.',
      refs: ['hudson2020', 'wright2026', 'hudson2019'],
    });
  }

  // Suggest a second trait early in consolidation, and only after a strong
  // week: the path asks people to finish what they take on before adding more.
  const primary = primaryGoal(state);
  const weeksIntoConsolidation = primary ? goalWeek(primary, date) - stageStarts(state.programWeeks).consolidate : -1;
  if (
    stage === 'consolidate' &&
    state.goals.length === 1 &&
    weeksIntoConsolidation < 2 &&
    prev != null &&
    completionRate(prev) >= 0.8 &&
    !tips.some((t) => t.id === 'behind')
  ) {
    tips.push({
      id: 'second-goal',
      tone: 'info',
      title: 'Ready for a second trait?',
      lead: 'Add one only if your first goal feels settled.',
      body: 'Gains stay in the trait you practise.',
      refs: ['hudson2019'],
      action: { label: 'Add a goal', route: 'goals' },
    });
  }

  if (isReassessmentDue(state, date)) {
    tips.push({
      id: 'reassess',
      tone: 'info',
      title: 'Time to retake the questionnaire',
      body: 'See how your scores are moving.',
      action: { label: 'Retake questionnaire', route: 'assess' },
    });
  }

  // Costs of acting extraverted showed up only in quite introverted people
  // (Jacques-Hamilton et al., 2019), so target this tip rather than nagging everyone.
  const latestE = state.assessments[state.assessments.length - 1]?.scores.E;
  const introverted = latestE != null && latestE <= INTROVERTED_E;
  const socialChallenge = week?.commitments.some((c) => {
    const ch = challengeById(c.challengeId);
    return ch?.trait === 'E' && (introverted || ch.level >= 3);
  });
  if (socialChallenge) {
    tips.push({
      id: 'recharge',
      tone: 'info',
      title: 'Plan time to recharge',
      lead: 'Rest after big social challenges.',
      body: 'Very introverted people sometimes found acting outgoing tiring.',
      refs: ['jacqueshamilton2019', 'leikas2017'],
    });
  }

  return tips;
}
