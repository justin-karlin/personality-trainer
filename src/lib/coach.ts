import type { AppState } from '../types';
import { addDays, daysBetween } from './dates';
import { suggestsSupport } from './scoring';
import { challengeById } from '../data/challenges';
import { completionRate, currentWeekIndex, findWeek, isReassessmentDue, previousPlannedWeek, weekStart } from './program';

export interface Tip {
  id: string;
  tone: 'info' | 'success' | 'warn' | 'care';
  title: string;
  body: string;
  refs?: string[];
  action?: { label: string; route: string };
}

const LOW_MOOD = 2;

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
      title: 'Your mood has been low for a few days',
      body:
        'Self-guided exercises help many people, but they are not a substitute for care. If low mood persists for two weeks or more, or you have any thoughts of harming yourself, please reach out to a doctor or therapist — or call or text 988 (US) / find a local line at findahelpline.com.',
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
      body:
        'Your last well-being check suggested a fair amount of anxiety or low mood. Self-guided practice works best alongside professional support at that level. Consider talking to a doctor or therapist.',
      refs: ['karyotaki2021'],
      action: { label: 'Support resources', route: 'settings' },
    });
  }

  const week = findWeek(state, idx);
  const prev = previousPlannedWeek(state, idx);

  if (prev && !prev.reflection && prev.weekIndex === idx - 1) {
    tips.push({
      id: 'reflect',
      tone: 'info',
      title: 'Reflect on last week before planning',
      body:
        'A few minutes looking back on what worked and what got in the way makes next week\'s plan better. Regular reflection and feedback were built into the PEACH app, which produced lasting trait change.',
      refs: ['stieger2021'],
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
        title: 'You met every target this week',
        body:
          'Following through is what predicts real change. Keep the momentum by repeating what worked. Repetition in the same context is how new behaviour turns into habit.',
        refs: ['hudson2019', 'lally2010'],
      });
    } else if (dayOfWeek >= 4 && rate < 0.4) {
      tips.push({
        id: 'behind',
        tone: 'warn',
        title: 'Shrink it rather than skip it',
        body:
          'Challenges you accept and then abandon don\'t help. Do the smallest possible version of one challenge today, and next week pick easier or fewer challenges.',
        refs: ['hudson2019'],
      });
    } else if (dayOfWeek > 0 && !didYesterday && openCommitments) {
      tips.push({
        id: 'missed',
        tone: 'info',
        title: 'Missed a day? That\'s fine',
        body:
          'Missing one opportunity did not derail habit formation in the classic habit study. The key is not to miss twice in a row. Check your if-then plan and look for today\'s cue.',
        refs: ['lally2010'],
      });
    }

    if (!state.checkins[date]) {
      tips.push({
        id: 'checkin',
        tone: 'info',
        title: 'Log today\'s check-in',
        body: 'A 20-second rating of how you acted today. Tracking your progress toward a goal helps you reach it.',
        refs: ['harkin2016'],
      });
    }
  }

  if (isReassessmentDue(state, date)) {
    tips.push({
      id: 'reassess',
      tone: 'info',
      title: 'Time to retake the questionnaire',
      body: 'Every four weeks, retake the questionnaire to see how your trait scores are moving.',
      action: { label: 'Retake questionnaire', route: 'assess' },
    });
  }

  // Only when this week includes a medium or stretch social challenge.
  const bigSocialChallenge = week?.commitments.some((c) => {
    const ch = challengeById(c.challengeId);
    return ch?.trait === 'E' && ch.level >= 2;
  });
  if (bigSocialChallenge) {
    tips.push({
      id: 'recharge',
      tone: 'info',
      title: 'Plan time to recharge',
      body:
        'Acting more outgoing tends to lift mood in the moment, but it can leave you tired a few hours later. Schedule some quiet time after bigger social challenges.',
      refs: ['leikas2017', 'jacqueshamilton2019'],
    });
  }

  return tips;
}
