import type { TraitId } from '../types';

export interface TraitInfo {
  id: TraitId;
  name: string;
  /** Name of the growth goal, e.g. "Build emotional stability". */
  goalName: string;
  goalShort: string;
  goalBlurb: string;
  short: string;
  /** One short line for each level, shown on the results screen. */
  high: string;
  mid: string;
  low: string;
  whyItMatters: string;
  whyPlaceholder: string;
  visionPlaceholder: string;
  /** Daily self-rating, worded so that higher = more of the goal. */
  stateItem: string;
  refs: string[];
}

export const TRAITS: Record<TraitId, TraitInfo> = {
  C: {
    id: 'C',
    name: 'Conscientiousness',
    goalName: 'Follow through',
    goalShort: 'Follow through',
    goalBlurb: 'Do what you said you would: plan, start and finish what matters (conscientiousness).',
    short: 'How organized, dependable, hard-working and goal-directed you are.',
    high: 'Organized and dependable.',
    mid: 'Organized in some areas, not others.',
    low: 'Flexible, but plans and tasks can slip.',
    whyItMatters:
      'Conscientiousness is one of the strongest personality predictors of a longer life, career success and staying married. In a semester-long study, students who completed more conscientiousness challenges reported becoming more conscientious than those who completed fewer.',
    whyPlaceholder: 'E.g. "I keep letting deadlines slip and it stresses me and my team out."',
    visionPlaceholder: 'E.g. "I plan tomorrow each evening, start hard tasks before noon, and keep my desk clear."',
    stateItem: 'Today I was organized and followed through on what I intended to do.',
    refs: ['roberts2007', 'hudson2019'],
  },
  A: {
    id: 'A',
    name: 'Agreeableness',
    goalName: 'Get along better',
    goalShort: 'Get along',
    goalBlurb: 'More patient, considerate and cooperative with the people around you (agreeableness).',
    short: 'How warm, compassionate, cooperative and trusting you are toward others.',
    high: 'Warm and cooperative.',
    mid: 'Warm with many, guarded at times.',
    low: 'Direct and sceptical; can cause friction.',
    whyItMatters:
      'Personality traits as a group help predict outcomes such as divorce, career success and lifespan. In one semester-long study of college students, those who completed more agreeableness challenges reported slightly bigger drops, or smaller rises, in "dark" traits such as manipulativeness and callousness than those who completed fewer. That study had no control group, and evidence that exercises like these change broad agreeableness is limited and mixed.',
    whyPlaceholder: 'E.g. "I get impatient and snappy with my partner and colleagues, and I don\'t like who I am then."',
    visionPlaceholder: 'E.g. "I listen fully before responding, give people the benefit of the doubt, and do one kind thing a day."',
    stateItem: 'Today I was warm, patient and considerate toward others.',
    refs: ['roberts2007', 'hudson2023'],
  },
  E: {
    id: 'E',
    name: 'Extraversion',
    goalName: 'Become more outgoing',
    goalShort: 'Extraversion',
    goalBlurb: 'More sociable, assertive, energetic and quick to take social initiative.',
    short: 'How sociable, assertive, talkative and energetic you are.',
    high: 'Sociable and energised by people.',
    mid: 'Enjoy company, and time alone.',
    low: 'Reserved; prefer small groups.',
    whyItMatters:
      'In a one-week trial, adults asked to act more outgoing reported more positive mood than those asked to act quiet and modest, with no average rise in bad mood or tiredness. The mood boost people recalled at the end of the week appeared only in those at or above average extraversion, and more introverted people showed possible costs, such as feeling more tired. Across 12 semester-long student studies, those who more strongly wanted to become more extraverted reported slightly more growth in it, a link second only to emotional stability.',
    whyPlaceholder: 'E.g. "I feel lonely and I miss out on opportunities because I never speak up."',
    visionPlaceholder: 'E.g. "I start conversations with colleagues, say yes to invitations, and share my ideas in meetings."',
    stateItem: 'Today I was sociable and took initiative with people.',
    refs: ['hudson2020', 'jacqueshamilton2019'],
  },
  O: {
    id: 'O',
    name: 'Openness',
    goalName: 'Become more open-minded',
    goalShort: 'Openness',
    goalBlurb: 'More curious, imaginative and open to new ideas, art and experiences.',
    short: 'How curious, imaginative and open to new ideas, art and experiences you are.',
    high: 'Curious and drawn to new ideas.',
    mid: 'Curious about some things.',
    low: 'Prefer the familiar and practical.',
    whyItMatters:
      'Openness is linked to enjoying ideas, creative thinking, and better health and a longer life. Evidence that it can be raised on purpose is limited: one trial raised it modestly in adults over 60 with 16 weeks of intensive reasoning training and puzzles, and in student studies, wanting more openness predicted the least extra growth of the five traits. Treat these challenges as experiments.',
    whyPlaceholder: 'E.g. "My life feels like a routine and I want to rediscover curiosity."',
    visionPlaceholder: 'E.g. "I try one new thing each week, read outside my field, and make time for art or nature."',
    stateItem: 'Today I was curious, or tried something new or in a new way.',
    refs: ['jackson2012', 'hudson2020'],
  },
  N: {
    id: 'N',
    name: 'Neuroticism',
    goalName: 'Build emotional stability',
    goalShort: 'Emotional stability',
    goalBlurb: 'Less worry, stress and mood swings; calmer and quicker to bounce back.',
    short: 'How prone you are to stress, worry, sadness, irritability and mood swings.',
    high: 'Feel stress and worry strongly.',
    mid: 'A typical amount of stress.',
    low: 'Calm under stress.',
    whyItMatters:
      'Neuroticism is the Big Five trait that changes most in intervention studies, which mostly treated mental-health problems such as depression and anxiety with therapy or medication. Which parts of treatment matter is unclear: the type of treatment made little difference overall, and a therapy aimed directly at handling strong emotions had only a small, uncertain edge over other forms of CBT. People lower in neuroticism tend to live longer and are less likely to divorce.',
    whyPlaceholder: 'E.g. "I spend hours worrying and it drains me and the people around me."',
    visionPlaceholder: 'E.g. "When I start to spiral, I notice it, name the feeling, and use a skill instead of ruminating."',
    stateItem: 'Today I stayed calm and bounced back from stress.',
    refs: ['roberts2017', 'sauerzavala2021', 'lorenzoluaces2023', 'roberts2007'],
  },
};

/**
 * The bounded promise for getting-along exercises: they practise specific behaviours, and
 * lasting change in broad agreeableness is not established (haehner2024's estimate for
 * agreeableness was uncertain; couples-intervention evidence doesn't transfer to solo practice).
 */
export const AGREEABLENESS_NOTE =
  "These exercises practise specific behaviours, such as listening, appreciation and handling disagreement well. Evidence that they lead to lasting change in broad agreeableness is limited and mixed. Getting along better doesn't mean giving in: you can still disagree, say no and keep your boundaries. Skip any exercise that doesn't fit the situation.";

