import type { Technique } from '../types';

// Evidence levels:
//   strong   – consistent benefits across multiple RCTs / meta-analyses
//   moderate – RCT support, but effects are small, mixed, or mostly vs. weak controls
//   emerging – early, lab-based, or correlational evidence; treat as an experiment
// `evidenceNote` always says which outcome the evidence is for: the trait itself,
// or a closely related outcome (anxiety, goal attainment, mood, connection...).

export const TECHNIQUES: Technique[] = [
  // ── Cross-cutting ───────────────────────────────────────────────────────
  {
    id: 'trait-practice',
    name: 'Practise the trait in everyday situations',
    traits: ['C', 'A', 'E', 'O', 'N'],
    summary:
      'Deliberately act the way a person with more of the trait would in specific, everyday situations, repeatedly, week after week.',
    how:
      'Traits are built from many repeated moments of behaviour. Over time the new behaviour becomes familiar and more automatic, and it changes how you see yourself.',
    evidence: 'moderate',
    evidenceNote:
      'In 16-week studies, completing trait-relevant challenges predicted trait growth (self-report). In the PEACH app trial, people changed in their chosen direction and friends noticed increases. Across studies the average effect is small (d ≈ 0.2), and one 2025 study found a waitlist changed as much, so some self-reported change may reflect expectations.',
    refs: ['hudson2019', 'stieger2021', 'stieger2020', 'hudson2023', 'olaru2025', 'wrzus2017', 'haehner2024', 'kramer2025'],
  },

  // ── Emotional stability (reducing neuroticism) ──────────────────────────
  {
    id: 'behavioral-activation',
    name: 'Behavioural activation',
    traits: ['N'],
    summary:
      'Schedule activities that give you a sense of pleasure or accomplishment, and do them whatever your mood. Then notice how you feel.',
    how:
      'Low mood makes us withdraw, which removes sources of reward and deepens the low mood. Acting on a plan rather than a feeling breaks that loop.',
    evidence: 'strong',
    evidenceNote:
      'A meta-analysis of 26 trials found large reductions in depression (many trials were small or low quality). In a large analysis of internet CBT, behavioural activation was one of the ingredients that helped.',
    refs: ['ekers2014', 'furukawa2021'],
  },
  {
    id: 'exercise',
    name: 'Physical activity',
    traits: ['N'],
    summary: 'Regular moderate-to-vigorous movement: brisk walks, runs, cycling, sport, strength training.',
    how: 'Exercise reduces physiological stress reactivity, improves sleep and mood, and gives you a sense of mastery.',
    evidence: 'strong',
    evidenceNote:
      'An overview of 97 reviews (1,000+ trials) found moderate reductions in depression, anxiety and distress. Higher intensity helped more.',
    refs: ['singh2023'],
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness practice',
    traits: ['N'],
    summary:
      'Short daily sessions of paying attention to the present (breath, body, sounds) and noticing thoughts and feelings without getting caught up in them.',
    how:
      'Practising non-reactive awareness makes it easier to notice a spiral early and let thoughts pass instead of ruminating.',
    evidence: 'strong',
    evidenceNote:
      'Meta-analyses show small-to-moderate reductions in anxiety and depression, including from apps (though apps were not better than other active activities). A 2025 meta-analysis found mindfulness also lowers neuroticism itself.',
    refs: ['goyal2014', 'linardon2024', 'almenrader2025'],
  },
  {
    id: 'approach',
    name: 'Approach what you avoid (graded exposure)',
    traits: ['N'],
    summary:
      'List situations you avoid because of anxiety, rank them from easiest to hardest, and face them one step at a time. Stay until the anxiety starts to fall, without "safety" crutches.',
    how:
      'Avoidance brings short-term relief but teaches your brain the situation is dangerous. Staying with it teaches the opposite.',
    evidence: 'strong',
    evidenceNote:
      'Exposure is the core of CBT for anxiety, which clearly beats placebo in meta-analyses. Therapist-led CBT of this kind has reduced neuroticism itself. In a 2025 app study (preprint), behavioural habits like this outlasted purely mental strategies.',
    refs: ['carpenter2018', 'sauerzavala2021', 'haehner2025chill'],
  },
  {
    id: 'self-compassion',
    name: 'Self-compassion',
    traits: ['N'],
    summary:
      'When you struggle or fail, respond to yourself the way you would to a good friend: acknowledge the pain, remember everyone struggles, and offer yourself kindness.',
    how:
      'Harsh self-criticism activates threat and keeps rumination going. Self-kindness calms it and makes it easier to try again.',
    evidence: 'moderate',
    evidenceNote:
      'A meta-analysis of 27 trials found moderate-to-large reductions in rumination, self-criticism, stress, depression and anxiety. Most comparisons were against waitlists.',
    refs: ['ferrari2019'],
  },
  {
    id: 'reappraisal',
    name: 'Rethink the situation (cognitive reappraisal)',
    traits: ['N'],
    summary:
      'When upset, write down the thought driving the feeling, then look for other explanations and ask how a calm friend would see it.',
    how: 'How you interpret an event shapes how you feel about it. Changing the interpretation changes the feeling.',
    evidence: 'moderate',
    evidenceNote:
      'Lab meta-analysis: reappraisal and perspective-taking reliably reduce negative emotion in the moment. But in internet CBT for depression, thought challenging added little by itself, so pair it with behavioural techniques.',
    refs: ['webb2012', 'furukawa2021'],
  },
  {
    id: 'worry-postponement',
    name: 'Worry postponement',
    traits: ['N'],
    summary:
      'Set a daily 15–30 minute "worry period" at a fixed time and place. When a worry pops up outside it, jot it down and postpone it.',
    how: 'It weakens the link between worry and every situation in your day, and shows you that worry can be controlled.',
    evidence: 'moderate',
    evidenceNote:
      'A two-week trial reduced worry, anxiety and insomnia. A meta-analysis of 7 trials found small effects on how long and how often people worried. There are no long-term follow-ups yet.',
    refs: ['mcgowan2013', 'dippel2023'],
  },
  {
    id: 'problem-solving',
    name: 'Structured problem-solving',
    traits: ['N', 'C'],
    summary:
      'Turn a vague worry into a defined problem, brainstorm options, pick one, schedule the first step, and review how it went.',
    how: 'It converts unproductive worry into action and builds a sense of control.',
    evidence: 'moderate',
    evidenceNote: 'Problem-solving therapy reduced depression across many trials.',
    refs: ['cuijpers2018ps'],
  },
  {
    id: 'expressive-writing',
    name: 'Expressive writing',
    traits: ['N'],
    summary: 'Write for 15–20 minutes about your deepest thoughts and feelings about a stressful experience, several days in a row.',
    how: 'Putting an experience into words helps you make sense of it and reduces the effort of holding it in.',
    evidence: 'moderate',
    evidenceNote: 'A meta-analysis of 146 trials found a reliable but small benefit.',
    refs: ['frattaroli2006'],
  },
  {
    id: 'affect-labeling',
    name: 'Name the feeling (emotion awareness)',
    traits: ['N'],
    summary: 'A few times a day, pause and put the feeling into 1–2 words, rate its intensity, and note the trigger.',
    how: 'Naming an emotion engages the thinking brain and quiets the alarm response. Tracking triggers reveals patterns.',
    evidence: 'emerging',
    evidenceNote:
      'Mostly lab and brain-imaging evidence. It is also a core module of the Unified Protocol, a transdiagnostic CBT that has lowered neuroticism when delivered by therapists.',
    refs: ['lieberman2007', 'sauerzavala2021'],
  },

  // ── Conscientiousness ───────────────────────────────────────────────────
  {
    id: 'implementation-intentions',
    name: 'If-then plans (implementation intentions)',
    traits: ['C', 'A', 'E', 'O', 'N'],
    summary: 'Decide exactly when, where and how you will act: "If [situation], then I will [action]."',
    how: 'The plan links the action to a cue, so the cue triggers the behaviour without needing fresh willpower or memory.',
    evidence: 'strong',
    evidenceNote:
      'A meta-analysis of 94 tests found a medium-to-large effect on goal attainment (d = 0.65). In volitional-change studies, coaching people to form if-then plans helped them change traits.',
    refs: ['gollwitzer2006', 'hudson2015'],
  },
  {
    id: 'woop',
    name: 'WOOP (mental contrasting + if-then plan)',
    traits: ['C'],
    summary:
      'Wish (what you want), Outcome (the best result, vividly), Obstacle (the main thing inside you that gets in the way), Plan (if obstacle, then action).',
    how: 'Contrasting the dream with the obstacle builds energy and realism. The if-then plan pre-loads the response to the obstacle.',
    evidence: 'strong',
    evidenceNote:
      'A meta-analysis (N ≈ 16,000) found improved goal attainment (g = 0.34), larger when done interactively.',
    refs: ['wang2021woop', 'oettingen2015'],
  },
  {
    id: 'self-monitoring',
    name: 'Track your progress',
    traits: ['C'],
    summary: 'Write down, daily, what you planned and what you actually did, and review the pattern weekly.',
    how: 'Monitoring makes the gap between intention and action visible and prompts correction.',
    evidence: 'strong',
    evidenceNote:
      'A meta-analysis of 138 studies found better goal attainment (d = 0.40), especially when progress was physically recorded.',
    refs: ['harkin2016'],
  },
  {
    id: 'habit',
    name: 'Build a tiny habit',
    traits: ['C', 'N'],
    summary:
      'Attach one small action to something you already do every day ("After I pour my coffee, I…") and repeat it in the same context.',
    how: 'Repetition in a stable context transfers control from effortful intention to automatic cue-response.',
    evidence: 'moderate',
    evidenceNote:
      'Habits took a median of about 66 days to become automatic (range 18–254). Missing a single day did not derail them.',
    refs: ['lally2010', 'gardner2012'],
  },
  {
    id: 'situation-design',
    name: 'Design your environment',
    traits: ['C'],
    summary:
      'Change the situation instead of relying on willpower: remove distractions, put what you need in sight, make the right thing the easy thing.',
    how: 'Temptations you never face cannot beat you. This is how highly self-controlled people actually operate.',
    evidence: 'moderate',
    evidenceNote: 'In randomized studies with students, changing the situation beat resisting temptation in the moment.',
    refs: ['duckworth2016'],
  },
  {
    id: 'temptation-bundling',
    name: 'Temptation bundling',
    traits: ['C'],
    summary: 'Only allow yourself a guilty pleasure (a podcast, show, treat) while doing a task you tend to put off.',
    how: 'It makes the "should" task immediately rewarding.',
    evidence: 'moderate',
    evidenceNote:
      'Increased gym visits in a field experiment, and weekly workouts by 10–14% in a large follow-up study, with effects fading over time.',
    refs: ['milkman2014', 'kirgios2020'],
  },
  {
    id: 'just-start',
    name: '"Just start" (beating procrastination)',
    traits: ['C'],
    summary:
      'Break an avoided task into a first step that takes 2–10 minutes, set a timer, and start. Note the thought that made you want to avoid it.',
    how: 'Starting is the hardest part. Once you begin, the task is rarely as aversive as predicted.',
    evidence: 'moderate',
    evidenceNote:
      'Internet CBT programmes that teach this reduced procrastination compared with a waitlist, both with and without a coach.',
    refs: ['rozental2015'],
  },
  {
    id: 'commitment-device',
    name: 'Commitment device',
    traits: ['C'],
    summary: 'Put something at stake: tell someone who will check, book a session with a friend, or pledge a donation if you skip.',
    how: 'It raises the immediate cost of backing out, helping your present self keep your past self\'s promise.',
    evidence: 'moderate',
    evidenceNote: 'Effective for those who used them in field experiments, but few people choose to sign up.',
    refs: ['gine2010'],
  },

  // ── Extraversion ────────────────────────────────────────────────────────
  {
    id: 'acting-extraverted',
    name: 'Act more outgoing',
    traits: ['E'],
    summary:
      'For a set time, deliberately behave in a more talkative, assertive, energetic and spontaneous way than usual, even if it doesn\'t feel natural at first.',
    how:
      'Behaving extraverted tends to bring more positive emotion and connection, which makes the behaviour rewarding and easier to repeat.',
    evidence: 'moderate',
    evidenceNote:
      'In week-long randomized experiments, acting extraverted raised positive mood, connectedness and well-being. One trial found introverts gained less and felt more tired; others found few costs. Another study found mood gains in the moment but more fatigue ~3 hours later, so build in recovery. Direct evidence for lasting trait change is limited.',
    refs: ['fleeson2002', 'jacqueshamilton2019', 'margolis2020', 'vanallen2021', 'leikas2017'],
  },
  {
    id: 'talk-strangers',
    name: 'Talk to strangers and "weak ties"',
    traits: ['E'],
    summary:
      'Start brief, genuine conversations with people you don\'t know or only know a little: baristas, neighbours, commuters, colleagues from other teams.',
    how:
      'People consistently underestimate how much they (and the other person) will enjoy these chats. Doing it corrects that pessimistic prediction and lowers fear of rejection.',
    evidence: 'moderate',
    evidenceNote:
      'Field experiments: commuters told to talk to a stranger had a more pleasant journey than they predicted. A week-long "talk to strangers" game reduced fear of rejection and increased confidence in conversation skills. Days with more weak-tie interactions go with more happiness. No trait-level outcome yet.',
    refs: ['epley2014', 'sandstrom2022', 'sandstrom2014'],
  },

  // ── Agreeableness ───────────────────────────────────────────────────────
  {
    id: 'loving-kindness',
    name: 'Loving-kindness meditation',
    traits: ['A'],
    summary:
      'Silently wish well-being to yourself, then a loved one, a neutral person, a difficult person, and everyone: "May you be safe, may you be happy, may you be healthy, may you live with ease."',
    how: 'It trains warmth and goodwill as a habit of mind, including toward people you find hard.',
    evidence: 'strong',
    evidenceNote:
      'Several meta-analyses of RCTs show moderate increases in compassion and positive emotions, and small-to-moderate increases in empathy and prosocial behaviour. Effects on trait agreeableness itself haven\'t been directly tested.',
    refs: ['galante2014', 'kirby2017', 'luberto2018', 'hofmann2011'],
  },
  {
    id: 'kindness',
    name: 'Deliberate acts of kindness',
    traits: ['A'],
    summary: 'Plan and carry out small acts of kindness or generosity: help, a favour, a gift, your time.',
    how: 'Practising prosocial behaviour builds the habit and the identity of being a kind person, and it feels good.',
    evidence: 'moderate',
    evidenceNote:
      'A meta-analysis found a small-to-medium boost to the giver\'s own well-being (δ = 0.28). Spending money on others made people happier than spending on themselves. Trait outcomes aren\'t well studied.',
    refs: ['curry2018', 'dunn2008'],
  },
  {
    id: 'gratitude',
    name: 'Expressing gratitude',
    traits: ['A'],
    summary: 'Tell people specifically what they did and how it helped you, in person, by message, or in a letter.',
    how: 'Gratitude directs attention to others\' good intentions and strengthens relationships.',
    evidence: 'moderate',
    evidenceNote:
      'Meta-analyses show small improvements in well-being, smaller when compared with active control activities. A gratitude letter and visit produced a notable, though temporary, boost in happiness.',
    refs: ['davis2016', 'seligman2005', 'toepfer2012'],
  },
  {
    id: 'forgiveness',
    name: 'Forgiveness (REACH)',
    traits: ['A'],
    summary:
      'Work through a grudge: Recall the hurt calmly, Empathize with the other person\'s perspective, see forgiveness as an Altruistic gift, Commit to it, and Hold on when the anger returns.',
    how: 'It reduces resentment and hostility, which are core to low agreeableness.',
    evidence: 'moderate',
    evidenceNote:
      'A meta-analysis found that structured forgiveness interventions increase forgiveness and reduce depression and anxiety. Most were delivered in groups or therapy.',
    refs: ['wade2014'],
  },
  {
    id: 'perspective-taking',
    name: 'Perspective-taking',
    traits: ['A'],
    summary:
      'Before reacting to someone, deliberately imagine their situation, pressures and intentions. Come up with charitable explanations for their behaviour.',
    how: 'Seeing the situation from the other side reduces anger and makes a considerate response more likely.',
    evidence: 'emerging',
    evidenceNote:
      'In lab studies, taking another perspective reliably reduced negative emotion (d ≈ 0.45). Evidence that practising it changes agreeableness is indirect.',
    refs: ['webb2012'],
  },
  {
    id: 'responsive-listening',
    name: 'Responsive listening',
    traits: ['A'],
    summary:
      'Listen to understand rather than to reply: no interrupting, reflect back what you heard, ask follow-up questions, and respond to good news with genuine enthusiasm.',
    how: 'Feeling understood and celebrated builds trust and closeness.',
    evidence: 'emerging',
    evidenceNote:
      'Mostly correlational and diary studies: enthusiastic, engaged responses to a partner\'s good news go with better relationships.',
    refs: ['gable2004'],
  },

  // ── Openness ────────────────────────────────────────────────────────────
  {
    id: 'novelty',
    name: 'Seek out novelty and new perspectives',
    traits: ['O'],
    summary: 'Regularly try unfamiliar things: foods, places, music, art, ideas, people with different views.',
    how: 'Openness is partly a habit of approaching the unfamiliar. Repeated positive experiences with novelty make it feel less threatening.',
    evidence: 'emerging',
    evidenceNote:
      'In a 2-week app study, people practising "openness to action" behaviours increased more on that facet than a comparison group, by self- and observer report. Across volitional-change studies, openness changes least of the five traits.',
    refs: ['stieger2020', 'hudson2020'],
  },
  {
    id: 'cognitive-training',
    name: 'Puzzles and reasoning practice',
    traits: ['O'],
    summary: 'Regularly work on reasoning puzzles, crosswords, sudoku, or learning a demanding new skill.',
    how: 'Building confidence in your thinking abilities may make intellectual challenges more attractive.',
    evidence: 'emerging',
    evidenceNote:
      'One RCT in older adults: ~16 weeks of reasoning training plus puzzles increased openness. It hasn\'t been replicated in other age groups.',
    refs: ['jackson2012'],
  },
  {
    id: 'awe',
    name: 'Awe',
    traits: ['O'],
    summary: 'Seek out experiences of vastness and wonder (nature, night sky, architecture, music) and give them your full attention.',
    how: 'Awe makes the self feel smaller and the world bigger, which opens you to new ideas.',
    evidence: 'emerging',
    evidenceNote: 'Weekly 15-minute "awe walks" increased awe and prosocial positive emotions in older adults (emotion, not trait, outcomes).',
    refs: ['sturm2020'],
  },
  {
    id: 'fiction',
    name: 'Reading literary fiction',
    traits: ['O'],
    summary: 'Read short stories or novels that immerse you in other people\'s minds, then reflect on what you felt.',
    how: 'Simulating other lives and perspectives may loosen fixed ways of seeing yourself and others.',
    evidence: 'emerging',
    evidenceNote:
      'One small experiment: reading a literary short story produced more change in self-reported traits than a matched non-fiction text, though in varied directions, not specifically toward openness.',
    refs: ['djikic2009'],
  },
];

export function techniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}
