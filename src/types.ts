// Big Five trait identifiers. N is scored as neuroticism (higher = more
// neurotic); the growth goal for N is to *lower* it.
export type TraitId = 'N' | 'E' | 'O' | 'A' | 'C';

export const TRAIT_IDS: TraitId[] = ['C', 'A', 'E', 'O', 'N'];
/**
 * Traits offered as new goals: follow-through (C) and getting along (A). The
 * questionnaire still measures all five, and goals people already have in the
 * other traits keep working.
 */
export const GOAL_TRAITS: TraitId[] = ['C', 'A'];

/** Traits to offer on the goal picker and in the toolkit: the focus traits plus any the user already works on. */
export function offeredTraits(goalTraits: TraitId[]): TraitId[] {
  return TRAIT_IDS.filter((t) => GOAL_TRAITS.includes(t) || goalTraits.includes(t));
}

export type TraitScores = Record<TraitId, number>;

/** How strong the research behind a technique is. */
export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

export interface Reference {
  id: string;
  /** Short in-text citation, e.g. "Hudson & Fraley, 2015". */
  short: string;
  authors: string;
  year: number;
  title: string;
  source: string;
  url: string;
  /** One-sentence plain-language takeaway. */
  finding: string;
}

export interface Technique {
  id: string;
  name: string;
  traits: TraitId[];
  /** What it is, in plain language. */
  summary: string;
  /** Why it is thought to work. */
  how: string;
  evidence: EvidenceLevel;
  /** What the evidence actually shows, including which outcome it was measured on. */
  evidenceNote: string;
  refs: string[];
}

export type ChallengeLevel = 1 | 2 | 3;

export interface Challenge {
  id: string;
  trait: TraitId;
  technique: string;
  level: ChallengeLevel;
  title: string;
  instructions: string;
  /** Suggested number of times per week. */
  perWeek: number;
  /** Rough minutes per occurrence. */
  minutes: number;
  /** Example if-then plan to help the user write their own. */
  ifThenExample: string;
}

export interface AssessmentItem {
  id: string;
  text: string;
  trait: TraitId;
  /** +1 if agreeing indicates more of the trait, -1 if reverse-keyed. */
  key: 1 | -1;
}

export interface AssessmentRecord {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  answers: Record<string, number>; // item id -> 1..5
  scores: TraitScores; // item means on a 1..5 scale
  /** Optional PHQ-4 screen: GAD-2 (anxiety) and PHQ-2 (depression) sums, 0..6 each. */
  wellbeing?: { anxiety: number; depression: number };
}

/** What usually gets in the way of following through. */
export type BarrierId = 'unclear' | 'too-big' | 'distraction' | 'perfectionism' | 'discomfort' | 'forgetting' | 'other';

/** The concrete follow-through problem a goal is about. */
export interface FollowThroughFocus {
  /** One task or commitment the user keeps putting off, in their words. */
  problem: string;
  /** How they would know it's getting better, in their words. */
  better: string;
  barrier?: BarrierId;
  /** The user's own description, when the barrier is 'other'. */
  barrierNote?: string;
}

export interface Goal {
  trait: TraitId;
  why: string;
  vision: string;
  createdAt: string;
  /** For follow-through goals: the specific problem being worked on. */
  focus?: FollowThroughFocus;
  /** Days the path's schedule has been pushed back by pauses and "another week" extensions. */
  pathDelayDays?: number;
  /** Set while the path is paused: the day it was paused. */
  pausedOn?: string;
  /** Mean of the 1–5 commitment check; absent for goals set before it existed. */
  commitment?: number;
  /** The individual commitment answers behind that mean. */
  commitmentAnswers?: number[];
}

/**
 * What happened with a planned action on one day.
 * - done: did the planned action
 * - partly: tried it but didn't finish
 * - skipped: the moment came up, but they didn't try
 * - no-chance: the moment didn't come up
 * A day with no entry is missing data, not a skip.
 */
export type ActionOutcome = 'done' | 'partly' | 'skipped' | 'no-chance';

/** An earlier wording of a commitment's if-then plan, kept when the plan is changed. */
export interface PlanRevision {
  ifThen: string;
  /** The day it was replaced. */
  replaced: string;
}

/**
 * One planned action for a week: the single record that the plan, any coach
 * suggestion, and every logged outcome refer to.
 */
export interface Commitment {
  challengeId: string;
  ifThen: string;
  confidence: number; // 0..10
  target: number; // times this week
  /**
   * Days the planned action was done (at most one per day); kept in step with `log`.
   * A date here with no `log` entry comes from before outcomes were logged: a
   * legacy practice day, which says nothing about opportunities or partial attempts.
   */
  completions: string[];
  /** The outcome logged for each day (ISO date → outcome). */
  log?: Record<string, ActionOutcome>;
  /** Earlier wordings of `ifThen`, oldest first. */
  revisions?: PlanRevision[];
  /** True when the current wording started from an AI coach suggestion. */
  coachDrafted?: boolean;
  /** How much the user enjoyed it (1..5), asked in the weekly reflection. */
  enjoyment?: number;
  /** The user's call in the weekly reflection: keep it as is, keep it with changes, or drop it. */
  next?: 'repeat' | 'change' | 'drop';
  /** A new wording or target for next week, from a weekly-review suggestion the user accepted. */
  nextIfThen?: string;
  nextTarget?: number;
}

export interface WeeklyReflection {
  date: string;
  wentWell: string;
  obstacles: string;
  nextTime: string;
  /** The challenge whose plan `nextTime` should replace next week, if the user chose one. */
  applyTo?: string;
  /** Anything that backfired or cost the user something (guilt, strain with someone, giving in). */
  downsides?: string;
}

export interface WeekPlan {
  weekIndex: number;
  startDate: string;
  commitments: Commitment[];
  reflection?: WeeklyReflection;
}

export interface DailyCheckin {
  date: string;
  /** Self-rated trait-consistent behaviour today, 1..7, keyed toward the goal direction. */
  states: Partial<Record<TraitId, number>>;
  mood?: number; // 1..7
  note?: string;
}

/** How someone who knows the user rated them (scored like the self-report, 1–5). */
export interface ObserverRating {
  id: string;
  requestId: string;
  date: string;
  relation: string;
  scores: Partial<Record<TraitId, number>>;
  /** Perceived change over the past couple of months, −2 (much less) … +2 (much more). */
  change: Partial<Record<TraitId, number>>;
}

/** A rating link the user sent, with a private label for who they sent it to. */
export interface SentRatingRequest {
  id: string;
  /** Who it was for, in the user's words (never sent to anyone). */
  label: string;
  date: string;
}

export interface AppState {
  version: 1;
  acceptedDisclaimer: boolean;
  startDate?: string; // program start (ISO date)
  programWeeks: number;
  assessments: AssessmentRecord[];
  goals: Goal[];
  weeks: WeekPlan[];
  checkins: Record<string, DailyCheckin>;
  /** Ratings from friends, family or colleagues, added from their reply links. */
  observerRatings?: ObserverRating[];
  /** Rating links sent, so replies from the same person can be compared over time. */
  ratingRequests?: SentRatingRequest[];
}
