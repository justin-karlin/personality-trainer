import type { AppState } from '../types';
import { addDays, daysBetween } from './dates';
import { suggestsSupport } from './scoring';
import { challengeById } from '../data/challenges';
import { currentStage, goalWeek, primaryGoal, stageStarts } from './path';
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
/** IPIP-50 extraversion mean at or below which we treat someone as introverted (about the 25th percentile). */
const INTROVERTED_E = 2.4;
/** IPIP-50 conscientiousness mean at or below which follow-through support is offered (about the 24th percentile in the app's norms). */
const LOW_C = 2.8;

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
        'Self-guided exercises help many people, but they are not a substitute for care. If low mood persists for two weeks or more, or you have any thoughts of harming yourself, please reach out to a doctor or therapist, or call or text 988 in the US. Elsewhere, find a local line at findahelpline.com.',
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
        'Before you plan next week, take a few minutes to look back on what worked and what got in the way. Reflection and progress feedback were part of PEACH, a coaching app whose users reported more change than people waiting to start it. The trial could not tell which of its parts helped.',
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
        title: 'You met every target this week',
        body:
          'In a 15-week study, students who completed more challenges reported more growth in three of the five traits. Keep the momentum by repeating what worked: repetition in the same context is how new behaviour turns into habit.',
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
          'Missing one opportunity did not derail habit formation in the classic habit study. Try not to miss twice in a row. Check your if-then plan and look for today\'s cue.',
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
      body:
        'In studies, people lower in conscientiousness were somewhat more likely to drop out, and people who practised more changed more. Keep this week light, put your if-then plans in your calendar, and if you miss a day, do the smallest version the next.',
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
      body:
        'You\'ve reached the consolidation step. Keep your best habits going. If your first goal feels settled, you can add a second trait; gains tend to stay in the trait you practise, so it needs its own challenges.',
      refs: ['hudson2019'],
      action: { label: 'Add a goal', route: 'goals' },
    });
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
      body:
        'In a week-long trial, acting more outgoing lifted mood on average with no extra tiredness. People well on the introverted side gained less and sometimes felt more tired or less like themselves. Plan some quiet time after bigger social challenges, and ease off if it starts to feel forced.',
      refs: ['jacqueshamilton2019', 'leikas2017'],
    });
  }

  return tips;
}
