import type { TraitId } from '../types';

export interface TraitInfo {
  id: TraitId;
  name: string;
  /** Name of the growth goal, e.g. "Build emotional stability". */
  goalName: string;
  goalShort: string;
  goalBlurb: string;
  short: string;
  high: string;
  mid: string;
  low: string;
  /** Facets (BFI-2 naming) that challenges target. */
  facets: string[];
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
    goalName: 'Become more conscientious',
    goalShort: 'Conscientiousness',
    goalBlurb: 'More organized, reliable and follow-through on what matters.',
    short: 'How organized, dependable, hard-working and goal-directed you are.',
    high: 'You tend to be organized, dependable and persistent. You plan ahead and follow through.',
    mid: 'you are organized and dependable in some areas and more spontaneous in others.',
    low: 'You tend to be flexible and spontaneous, but may find it harder to stay organized, start tasks, or follow through on plans.',
    facets: ['Organization', 'Productiveness', 'Responsibility'],
    whyItMatters:
      'Conscientiousness is one of the strongest personality predictors of health, longevity, job performance and relationship stability. It is also one of the traits that responds to deliberate practice.',
    whyPlaceholder: 'E.g. "I keep letting deadlines slip and it stresses me and my team out."',
    visionPlaceholder: 'E.g. "I plan tomorrow each evening, start hard tasks before noon, and keep my desk clear."',
    stateItem: 'Today I was organized and followed through on what I intended to do.',
    refs: ['roberts2007', 'hudson2019'],
  },
  A: {
    id: 'A',
    name: 'Agreeableness',
    goalName: 'Become warmer and kinder',
    goalShort: 'Agreeableness',
    goalBlurb: 'More compassionate, considerate, patient and cooperative with others.',
    short: 'How warm, compassionate, cooperative and trusting you are toward others.',
    high: 'You tend to be warm, considerate and cooperative, and quick to see others\' points of view.',
    mid: 'you are warm and cooperative with many people, but can be more guarded or critical at times.',
    low: 'You tend to be direct, sceptical and competitive. That can be useful, but it may cause friction or distance in relationships.',
    facets: ['Compassion', 'Respectfulness', 'Trust'],
    whyItMatters:
      'Agreeableness supports close relationships, teamwork and social support. An intervention targeting agreeableness also reduced "dark" traits such as manipulativeness and callousness.',
    whyPlaceholder: 'E.g. "I get impatient and snappy with my partner and colleagues, and I don\'t like who I am then."',
    visionPlaceholder: 'E.g. "I listen fully before responding, give people the benefit of the doubt, and do one kind thing a day."',
    stateItem: 'Today I was warm, patient and considerate toward others.',
    refs: ['hudson2023'],
  },
  E: {
    id: 'E',
    name: 'Extraversion',
    goalName: 'Become more outgoing',
    goalShort: 'Extraversion',
    goalBlurb: 'More sociable, assertive, energetic and quick to take social initiative.',
    short: 'How sociable, assertive, talkative and energetic you are.',
    high: 'You tend to be sociable, talkative and energised by other people, and you often take the lead.',
    mid: 'you enjoy company and can take initiative, but you also value time alone.',
    low: 'You tend to be reserved and prefer smaller groups or solitude. You may hold back from starting conversations or speaking up.',
    facets: ['Sociability', 'Assertiveness', 'Energy level'],
    whyItMatters:
      'Behaving more extraverted reliably boosts positive mood and feelings of connection in the moment. In volitional-change studies, extraversion is one of the traits that changes most readily.',
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
    high: 'You tend to be curious and imaginative, drawn to new ideas, art and experiences.',
    mid: 'you are curious about some things and prefer the familiar in others.',
    low: 'You tend to prefer the familiar and practical, and may be less drawn to abstract ideas, art or novelty.',
    facets: ['Intellectual curiosity', 'Aesthetic sensitivity', 'Creative imagination'],
    whyItMatters:
      'Openness is linked to learning, creativity and adapting to change. It has the thinnest intervention evidence of the five traits, so treat these challenges as experiments.',
    whyPlaceholder: 'E.g. "My life feels like a routine and I want to rediscover curiosity."',
    visionPlaceholder: 'E.g. "I try one new thing each week, read outside my field, and make time for art or nature."',
    stateItem: 'Today I was curious and open to new ideas or experiences.',
    refs: ['jackson2012', 'hudson2020'],
  },
  N: {
    id: 'N',
    name: 'Neuroticism',
    goalName: 'Build emotional stability',
    goalShort: 'Emotional stability',
    goalBlurb: 'Less worry, stress and mood swings; calmer and quicker to bounce back.',
    short: 'How prone you are to stress, worry, sadness, irritability and mood swings.',
    high: 'You tend to feel stress, worry and low moods intensely and often. This is the trait with the strongest evidence that it can be reduced.',
    mid: 'you experience a typical amount of stress and worry, with some ups and downs.',
    low: 'You tend to be calm, even-tempered and resilient under stress.',
    facets: ['Anxiety', 'Depression', 'Emotional volatility'],
    whyItMatters:
      'Neuroticism is the Big Five trait that changes most with intervention, largely because the skills taught in therapies like CBT reduce it. Lower neuroticism predicts better mental and physical health.',
    whyPlaceholder: 'E.g. "I spend hours worrying and it drains me and the people around me."',
    visionPlaceholder: 'E.g. "When I start to spiral, I notice it, name the feeling, and use a skill instead of ruminating."',
    stateItem: 'Today I stayed calm and bounced back from stress.',
    refs: ['roberts2017', 'sauerzavala2021'],
  },
};
