// The science page as a swipeable deck: one finding per card, in plain language, with a
// chart of the study's own numbers. Every figure was checked against the papers' full
// texts (or, for Gollwitzer & Sheeran 2006, Lally et al. 2010 and Roberts et al. 2007,
// their abstracts); see docs/RESEARCH.md.

/** The chart or diagram drawn above a card's fact (see components/CardViz.tsx). */
export type Viz =
  | {
      kind: 'bars';
      /** What is measured, with its unit. */
      title: string;
      rows: { label: string; value: number; display: string; emphasis?: boolean }[];
      /** A shared scale, so the same unit is drawn the same size on neighbouring cards. */
      domain?: [number, number];
    }
  | {
      kind: 'line';
      title: string;
      xLabels: string[];
      series: { label: string; values: (number | null)[]; emphasis?: boolean }[];
      labelPoints?: { series: number; index: number; text: string }[];
    }
  | {
      kind: 'stat';
      value: string;
      label: string;
      minis?: { value: string; label: string }[];
      /** Places an effect size on a conventional small/medium/large ruler. */
      scale?: { value: number; max: number; marks: { at: number; label: string }[] };
    }
  | {
      /** A spread of values (shortest, average, longest) on one axis. */
      kind: 'range';
      title: string;
      unit: string;
      axisMax: number;
      ticks: number[];
      min: { value: number; label: string; display?: string };
      mean: { value: number; label: string; display?: string };
      max: { value: number; label: string; display?: string };
    }
  | {
      kind: 'compare';
      left: { heading: string; verdict: string; note: string };
      right: { heading: string; verdict: string; note: string };
      emphasis: 'left' | 'right';
    }
  | { kind: 'streak'; title: string; days: string; caption: string };

export interface ScienceCard {
  id: string;
  kicker: string;
  /** The big line on the card: short, confident and true. */
  fact: string;
  /** One short supporting line (about 12 words). */
  detail: string;
  refs: string[];
  viz: Viz;
  /** Tiny caption under the chart, after the reference links: sample, design, measure. */
  note: string;
  /** The chart in one sentence, for screen readers. */
  alt: string;
}

export const SCIENCE_CARDS: ScienceCard[] = [
  {
    id: 'can-change',
    kicker: 'The big idea',
    fact: 'Personality can change on purpose.',
    detail: 'App users moved toward their chosen trait in 12 weeks; a waitlist didn’t.',
    refs: ['stieger2021'],
    viz: {
      kind: 'bars',
      title: 'Self-rated change in a trait people wanted more of (effect size d)',
      rows: [
        { label: 'Coaching app, 12 weeks', value: 0.44, display: '+0.44', emphasis: true },
        { label: 'Waitlist, 4 weeks', value: -0.12, display: '−0.12' },
      ],
      domain: [-0.2, 0.6],
    },
    note: 'randomized trial · self-report',
    alt: 'Bar chart: people raising a trait with the coaching app changed +0.44 over 12 weeks; the waitlist changed −0.12 over its 4-week wait.',
  },
  {
    id: 'faster',
    kicker: 'How much',
    fact: 'About five times faster than natural change.',
    detail: 'Across 7 studies, programs beat natural change about fivefold, though effects were small.',
    refs: ['haehner2024'],
    viz: {
      kind: 'bars',
      title: 'Average change in the targeted trait, before vs after (effect size d)',
      rows: [
        { label: 'Natural change, same span', value: 0.04, display: '0.04' },
        { label: 'Just wanting to change', value: 0.14, display: '0.14' },
        { label: 'Structured program', value: 0.22, display: '0.22', emphasis: true },
      ],
      domain: [0, 0.6],
    },
    note: 'separate estimates, not head-to-head',
    alt: 'Bar chart of average before-to-after change in the targeted trait: natural change 0.04, just wanting to change 0.14, structured programs 0.22.',
  },
  {
    id: 'months',
    kicker: 'How long',
    fact: 'Measurable change in 2–3 months.',
    detail: 'Programs averaged about 10 weeks, nearly all meeting at least weekly.',
    refs: ['haehner2024'],
    viz: {
      kind: 'range',
      title: 'How long change programs ran (weeks)',
      unit: 'wks',
      axisMax: 16,
      ticks: [0, 4, 8, 12, 16],
      min: { value: 2, label: 'Shortest' },
      mean: { value: 10.5, label: 'Average' },
      max: { value: 16, label: 'Longest', display: 'about 16' },
    },
    note: '19 programs in 16 studies',
    alt: 'Range chart of program length: the shortest ran 2 weeks, the average 10.5 weeks and the longest about 16 weeks.',
  },
  {
    id: 'lasts',
    kicker: 'Does it stick?',
    fact: 'Gains seemed to last up to a year.',
    detail: 'In the 4 studies that checked back, change seemed to hold.',
    refs: ['haehner2024', 'stieger2024'],
    viz: {
      kind: 'stat',
      value: '0.37',
      label: 'Average change toward the goal, from before the program to follow-ups up to a year later (effect size d)',
      minis: [
        { value: '4', label: 'studies checked back' },
        { value: '1 in 10', label: 'answered at 1 year (app trial)' },
      ],
      scale: { value: 0.37, max: 0.8, marks: [{ at: 0.2, label: 'small' }, { at: 0.5, label: 'medium' }, { at: 0.8, label: 'large' }] },
    },
    note: 'exploratory · self-report',
    alt: 'Large figure 0.37: average change toward the goal from before the program to follow-ups up to a year later, pooled from 4 studies; in one app trial about 1 in 10 users answered at one year.',
  },
  {
    id: 'doing',
    kicker: 'What works',
    fact: 'Doing beats wanting.',
    detail: 'Completing weekly challenges went with growth; just accepting them didn’t.',
    refs: ['baranski2020', 'hudson2019'],
    viz: {
      kind: 'bars',
      title: 'Predicted monthly change in self-rated extraversion (SD)',
      rows: [
        { label: 'No challenges completed', value: -0.04, display: '−0.04' },
        { label: 'Two a week completed', value: 0.05, display: '+0.05', emphasis: true },
      ],
    },
    note: '377 students · 15 weeks · model estimates',
    alt: 'Bar chart: in a model of self-rated extraversion, students who completed no extraversion challenges were predicted to decline 0.04 SD a month; those completing two a week were predicted to rise 0.05 SD a month.',
  },
  {
    id: 'practice',
    kicker: 'Practice',
    fact: 'With a chosen goal, more practice went with more growth.',
    detail: 'About 8 challenges a week predicted growth; about 2 a week, none.',
    refs: ['hudson2021'],
    viz: {
      kind: 'line',
      title: 'Predicted change in self-rated emotional stability, students who chose it (SD)',
      xLabels: ['Start', 'Week 16'],
      series: [
        { label: '~8 challenges a week', values: [0, 0.42], emphasis: true },
        { label: '~2 a week', values: [0, 0] },
      ],
      labelPoints: [
        { series: 0, index: 1, text: '+0.42' },
        { series: 1, index: 1, text: '0' },
      ],
    },
    note: '414 students · model estimates',
    alt: 'Line chart: students who chose emotional stability and completed about 8 challenges a week were predicted to rise 0.42 SD in self-rated emotional stability over 16 weeks; at about 2 a week, no change.',
  },
  {
    id: 'commit',
    kicker: 'Most consistent',
    fact: 'Commitment was the most consistent predictor.',
    detail: 'Commitment was the only factor linked to change on every measure.',
    refs: ['olaru2026'],
    viz: {
      kind: 'bars',
      title: 'Significant links, of 4 measures',
      rows: [
        { label: 'Commitment to the goal', value: 4, display: '4 of 4', emphasis: true },
        { label: 'If-then plans carried out', value: 3, display: '3 of 4' },
        { label: 'Enjoying the plans', value: 3, display: '3 of 4' },
        { label: 'How much they wanted to change', value: 1, display: '1 of 4' },
      ],
    },
    note: '956 adults · correlational, small effects',
    alt: 'Bar chart counting significant links to change across 4 measures: commitment 4 of 4, carrying out if-then plans 3, enjoying them 3, wanting to change 1.',
  },
  {
    id: 'everyone',
    kicker: 'Who can change',
    fact: 'A group’s age or gender mix didn’t predict change.',
    detail: 'Across 207 studies, a sample’s average age and gender mix didn’t matter.',
    refs: ['roberts2017'],
    viz: {
      kind: 'stat',
      value: '207',
      label: 'studies in which neither a sample’s average age nor its share of women predicted its change',
      minis: [
        { value: '36', label: 'average sample age (range 19–73)' },
        { value: '63%', label: 'women overall' },
      ],
    },
    note: 'mostly clinical samples · sample-level results',
    alt: 'Statistic: in 207 intervention studies, neither a sample’s average age (mean 36, range 19 to 73) nor its share of women (63% overall) predicted how much its trait scores changed.',
  },
  {
    id: 'ifthen',
    kicker: 'The method',
    fact: 'If-then plans help turn intentions into action.',
    detail: 'Across 94 tests, deciding when and where to act helped people reach goals.',
    refs: ['gollwitzer2006', 'hudson2015'],
    viz: {
      kind: 'stat',
      value: '0.65',
      label: 'Average effect of if-then plans on reaching goals (effect size d)',
      minis: [
        { value: '94', label: 'tests pooled' },
        { value: '3 of 5', label: 'traits where wanted change came faster (one trial)' },
      ],
      scale: { value: 0.65, max: 0.8, marks: [{ at: 0.2, label: 'small' }, { at: 0.5, label: 'medium' }, { at: 0.8, label: 'large' }] },
    },
    note: 'meta-analysis · one student trial, self-rated',
    alt: 'Large figure 0.65: the average effect of if-then plans on reaching goals across 94 tests; in one student trial, coaching with if-then plans sped self-rated change toward goals in 3 of 5 traits.',
  },
  {
    id: 'choose',
    kicker: 'Your call',
    fact: 'Choosing your goal yourself can matter.',
    detail: 'Calmness practice helped only when people chose that goal themselves.',
    refs: ['hudson2021'],
    viz: {
      kind: 'bars',
      title: 'Extra monthly growth per ~3 more challenges a week (SD)',
      rows: [
        { label: 'Emotional stability, chosen', value: 0.06, display: '+0.06', emphasis: true },
        { label: 'Emotional stability, secretly assigned', value: -0.04, display: '−0.04' },
        { label: 'Conscientiousness, either way', value: 0.03, display: '+0.03' },
      ],
    },
    note: '414 students · self-report · correlational',
    alt: 'Bar chart: more emotional-stability practice went with +0.06 SD extra monthly growth for people who chose that goal and −0.04 for people secretly given those challenges instead; for conscientiousness, +0.03 either way.',
  },
  {
    id: 'enjoy',
    kicker: 'Keep it pleasant',
    fact: 'People who enjoyed practice reported a bit more change.',
    detail: 'Those who found their plans pleasant reported slightly more change.',
    refs: ['olaru2026'],
    viz: {
      kind: 'stat',
      value: '0.10–0.15',
      label: 'A small link between enjoying if-then plans and self-rated change (standardised β)',
      minis: [
        { value: '3 of 4', label: 'measures, all self-rated' },
        { value: '956', label: 'people in the study' },
      ],
    },
    note: 'app study · correlational',
    alt: 'Large figure 0.10 to 0.15: the small link between enjoying if-then plans and self-rated change, seen on 3 of 4 measures but not in ratings by friends and family.',
  },
  {
    id: 'comeback',
    kicker: 'Bad day?',
    fact: 'Missing one day didn’t derail habit-building.',
    detail: 'Missing one chance didn’t stop a daily habit becoming automatic.',
    refs: ['lally2010'],
    viz: {
      kind: 'streak',
      title: 'Two weeks of practice, one day missed',
      days: 'xxxxxx-xxxxxxx',
      caption: 'Illustration, not data: one missed day, then practice picks up again.',
    },
    note: '96 volunteers · 12 weeks',
    alt: 'Illustration, not data: a strip of 14 days with one missed day and practice resuming the next day.',
  },
  {
    id: 'noticed',
    kicker: 'Seen by others',
    fact: 'Friends and family saw the gains, less strongly.',
    detail: 'Friends saw rises in wanted traits, but no clear drops in unwanted ones.',
    refs: ['stieger2021'],
    viz: {
      kind: 'bars',
      title: 'Rise in a trait people wanted more of, start to 3 months after the program (effect size d)',
      rows: [
        { label: 'Self-rated', value: 0.52, display: '0.52' },
        { label: 'Rated by friends and family', value: 0.35, display: '0.35', emphasis: true },
      ],
      domain: [0, 0.6],
    },
    note: 'no control group at follow-up',
    alt: 'Bar chart: for traits people wanted more of, self-rated change was 0.52 and friends and family rated 0.35, from the start to 3 months after the program.',
  },
  {
    id: 'calm',
    kicker: 'Emotional stability',
    fact: 'Calm can be trained.',
    detail: 'A 6-week app trial lowered self-rated neuroticism versus an active control.',
    refs: ['wright2026'],
    viz: {
      kind: 'stat',
      value: '−0.24',
      label: 'Self-rated neuroticism vs an active control using the same app (average effect size d; lower is calmer)',
      minis: [
        { value: '−0.18', label: 'rated by close others, later' },
        { value: '446', label: 'adults in the trial' },
      ],
      scale: { value: 0.24, max: 0.8, marks: [{ at: 0.2, label: 'small' }, { at: 0.5, label: 'medium' }, { at: 0.8, label: 'large' }] },
    },
    note: 'randomized, active control',
    alt: 'Large figure −0.24: the drop in self-rated neuroticism with the app compared with an active control; close others rated a −0.18 drop at follow-up, on one of two measures.',
  },
  {
    id: 'matters',
    kicker: 'Why bother',
    fact: 'Traits predict how life goes.',
    detail: 'Traits predicted divorce, careers and lifespan about as well as IQ did.',
    refs: ['roberts2007', 'haehner2026'],
    viz: {
      kind: 'compare',
      left: {
        heading: 'Trait levels',
        verdict: 'Predict divorce, career and lifespan',
        note: 'About as well as IQ or income and education',
      },
      right: { heading: 'Changing them', verdict: 'Payoff less clear', note: 'Few studies so far' },
      emphasis: 'left',
    },
    note: 'associations, not proof of cause',
    alt: 'Two panels: trait levels predict divorce, career success and lifespan about as well as IQ or income and education; whether changing traits changes these outcomes is less clear.',
  },
  {
    id: 'honest',
    kicker: 'The fine print',
    fact: 'Self-ratings can shift with no program.',
    detail: 'Waitlisted people rated themselves nearly as improved as participants.',
    refs: ['kramer2025', 'haehner2026'],
    viz: {
      kind: 'bars',
      title: 'Drop in self-rated neuroticism over 3 months (standardised β)',
      rows: [
        { label: 'Self-improvement program', value: 0.208, display: '0.21' },
        { label: 'Self-acceptance program', value: 0.206, display: '0.21' },
        { label: 'Waitlist, no program yet', value: 0.153, display: '0.15', emphasis: true },
      ],
    },
    note: 'differences not significant',
    alt: 'Bar chart of the 3-month drop in self-rated neuroticism: 0.21 in each of two light online programs and 0.15 on the waitlist; the differences were not significant.',
  },
];
