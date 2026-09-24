// Big Five trait identifiers. N is scored as neuroticism (higher = more
// neurotic); the growth goal for N is to *lower* it.
export type TraitId = 'N' | 'E' | 'O' | 'A' | 'C';

export const TRAIT_IDS: TraitId[] = ['C', 'A', 'E', 'O', 'N'];

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

export interface Goal {
  trait: TraitId;
  why: string;
  vision: string;
  createdAt: string;
}

export interface Commitment {
  challengeId: string;
  ifThen: string;
  confidence: number; // 0..10
  target: number; // times this week
  completions: string[]; // ISO dates, at most one per day
  /** How much the user enjoyed it (1..5), asked in the weekly reflection. */
  enjoyment?: number;
}

export interface WeeklyReflection {
  date: string;
  wentWell: string;
  obstacles: string;
  nextTime: string;
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

export interface AppState {
  version: 1;
  acceptedDisclaimer: boolean;
  startDate?: string; // program start (ISO date)
  programWeeks: number;
  assessments: AssessmentRecord[];
  goals: Goal[];
  weeks: WeekPlan[];
  checkins: Record<string, DailyCheckin>;
}
