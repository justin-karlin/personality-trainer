// The science page as a swipeable deck: one fact per card, in plain language,
// using only claims already checked against the cited papers (see docs/RESEARCH.md).

export type SceneId =
  | 'sprout'
  | 'faster'
  | 'calendar'
  | 'lasting'
  | 'doing'
  | 'practice'
  | 'commit'
  | 'everyone'
  | 'ifthen'
  | 'choose'
  | 'enjoy'
  | 'comeback'
  | 'noticed'
  | 'calm'
  | 'matters'
  | 'honest';

export interface ScienceCard {
  id: string;
  scene: SceneId;
  kicker: string;
  /** The big line on the card: short, confident and true. */
  fact: string;
  /** One supporting sentence. */
  detail: string;
  refs: string[];
}

export const SCIENCE_CARDS: ScienceCard[] = [
  {
    id: 'can-change',
    scene: 'sprout',
    kicker: 'The big idea',
    fact: 'Personality can change on purpose.',
    detail:
      'In a randomized trial of a coaching app, people changed the trait they chose more than a waitlist group, and still showed it 3 months later.',
    refs: ['stieger2021'],
  },
  {
    id: 'faster',
    scene: 'faster',
    kicker: 'How much',
    fact: 'About five times faster than waiting.',
    detail:
      'On average, structured programs produced about five times the change that happens naturally over the same months.',
    refs: ['haehner2024'],
  },
  {
    id: 'months',
    scene: 'calendar',
    kicker: 'How long',
    fact: 'Measurable change in 2–3 months.',
    detail: 'Programs ran about 10 weeks on average. Most of the evidence comes from how people rated themselves.',
    refs: ['haehner2024'],
  },
  {
    id: 'lasts',
    scene: 'lasting',
    kicker: 'Does it stick?',
    fact: 'The gains lasted.',
    detail:
      'Changes held at follow-ups up to a year later. In one app trial, people aiming to be calmer kept getting calmer after it ended.',
    refs: ['haehner2024', 'stieger2024'],
  },
  {
    id: 'doing',
    scene: 'doing',
    kicker: 'What works',
    fact: 'Doing beats wanting.',
    detail:
      'Wanting to change, on its own, did little. Completing small weekly challenges is what went with growth.',
    refs: ['baranski2020', 'hudson2019'],
  },
  {
    id: 'practice',
    scene: 'practice',
    kicker: 'Dose matters',
    fact: 'More practice, more change.',
    detail:
      'Students who chose emotional stability and did about eight challenges a week grew clearly within four months; at two a week, they didn’t change.',
    refs: ['hudson2021'],
  },
  {
    id: 'commit',
    scene: 'commit',
    kicker: 'The strongest predictor',
    fact: 'Commitment counts most.',
    detail:
      'In an app study of 956 people, commitment to the goal was the only predictor linked to change on every measure, including ratings by friends and family.',
    refs: ['olaru2026'],
  },
  {
    id: 'everyone',
    scene: 'everyone',
    kicker: 'Who can change',
    fact: 'It’s what you do, not who you are.',
    detail: 'Across 207 studies, age and gender didn’t predict how much people changed.',
    refs: ['roberts2017'],
  },
  {
    id: 'ifthen',
    scene: 'ifthen',
    kicker: 'The method',
    fact: 'If-then plans turn intentions into action.',
    detail:
      'Deciding exactly when and where you’ll act clearly improves follow-through. In one study it about doubled self-rated gains for people who wanted to be more outgoing.',
    refs: ['gollwitzer2006', 'hudson2015'],
  },
  {
    id: 'choose',
    scene: 'choose',
    kicker: 'Your call',
    fact: 'Choose your goal yourself.',
    detail:
      'For emotional stability, practice only went with growth in people who had chosen that goal themselves.',
    refs: ['hudson2021'],
  },
  {
    id: 'enjoy',
    scene: 'enjoy',
    kicker: 'Keep it pleasant',
    fact: 'Enjoying it helps.',
    detail: 'People who enjoyed their practice reported a bit more change, so the app suggests the challenges you liked again.',
    refs: ['olaru2026'],
  },
  {
    id: 'comeback',
    scene: 'comeback',
    kicker: 'Bad day?',
    fact: 'Missing a day is fine. Coming back is what counts.',
    detail: 'One missed day didn’t derail habit-building in the classic habit study. Try not to miss twice in a row.',
    refs: ['lally2010'],
  },
  {
    id: 'noticed',
    scene: 'noticed',
    kicker: 'Seen by others',
    fact: 'Friends and family notice.',
    detail: 'In a randomized app trial, people close to the participants saw their increases too, often a little later.',
    refs: ['stieger2021'],
  },
  {
    id: 'calm',
    scene: 'calm',
    kicker: 'Emotional stability',
    fact: 'Calm can be trained.',
    detail:
      'In a 6-week app trial, people rated themselves less neurotic than an active control group did, similar to what therapy achieves for people without a diagnosis.',
    refs: ['wright2026'],
  },
  {
    id: 'matters',
    scene: 'matters',
    kicker: 'Why bother',
    fact: 'Traits predict how life goes.',
    detail:
      'Traits predict relationships, success at work, health and even lifespan, often as strongly as IQ or income and education.',
    refs: ['roberts2007'],
  },
  {
    id: 'honest',
    scene: 'honest',
    kicker: 'The fine print',
    fact: 'Strong ideas, honest limits.',
    detail:
      'Most results come from people’s own ratings, and this app’s exact mix hasn’t been tested as a whole. The full evidence is below.',
    refs: ['kramer2025', 'haehner2026'],
  },
];
