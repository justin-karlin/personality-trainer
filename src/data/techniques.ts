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
    name: 'Everyday practice',
    traits: ['C', 'A', 'E', 'O', 'N'],
    summary:
      'Deliberately act the way a person with more of the trait would in specific, everyday situations, repeatedly, week after week.',
    how:
      'The idea is that traits build up from many repeated moments of behaviour. With practice, new behaviour may become more familiar and automatic, and may change how you see yourself. This is still theory: studies link more practice to more self-reported change, but have not shown how the change happens.',
    evidence: 'moderate',
    evidenceNote:
      'Rated for the whole coaching package: in a randomized app trial (PEACH), 3 months of coaching that included everyday practice moved people toward their goal more than a 1-month waitlist (self-report), and people close to them saw smaller changes, only for increases. In two correlational student studies, completing more practice tasks went with more self-reported growth in extraversion and emotional stability, sometimes conscientiousness or agreeableness, and never openness. Across 7 programs the average before-and-after change was small (d ≈ 0.2, not compared with a control group), and in a 2025 paper on two lighter online programs a waitlist improved nearly as much, so some change may reflect expectations or who signs up.',
    refs: ['stieger2021', 'hudson2019', 'hudson2023', 'olaru2026', 'wrzus2017', 'haehner2024', 'kramer2025'],
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
      'The idea is that practising noticing thoughts and feelings without reacting makes it easier to catch a spiral early. How mindfulness programs work is not yet known; part of the benefit may be becoming less prone to negative emotion in general, as with other therapies.',
    evidence: 'strong',
    evidenceNote:
      'Strong for anxiety and depression: meta-analyses show small-to-moderate reductions, including from apps, though apps did no better than other active activities. For neuroticism the evidence is moderate: a 2024 meta-analysis of 45 studies found it fell more than on waitlists and about as much as with other active therapies (only 6 studies), but all studies used self-report and most measured anxiety or worry instead. Those studies tested full programs, usually 8 weeks; short daily practices like these are a lighter version.',
    refs: ['goyal2014', 'linardon2024', 'almenrader2024'],
  },
  {
    id: 'approach',
    name: 'Face what you avoid',
    traits: ['N'],
    summary:
      'List situations you avoid because of anxiety, rank them from easiest to hardest, and face them one step at a time. Stay until the anxiety starts to fall, without "safety" crutches.',
    how:
      'Avoidance brings short-term relief but teaches your brain the situation is dangerous. Staying with it teaches the opposite.',
    evidence: 'strong',
    evidenceNote:
      'Exposure is the core of CBT for anxiety, which clearly beats placebo in meta-analyses. Its effect on neuroticism is less clear: in one trial in anxiety patients, standard CBT for a specific disorder, with exposures aimed at particular feared situations, lowered neuroticism no more than a waitlist. A broader therapist-led CBT that practised facing strong emotions across many situations (the Unified Protocol) lowered it modestly, but which part helped is unclear.',
    refs: ['carpenter2018', 'sauerzavala2021'],
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
    name: 'Rethink the situation',
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
      'Set a daily 30-minute "worry period" at the same time and place. When a worry pops up outside it, stop, put it off until then, and bring your attention back to what you\'re doing.',
    how: 'The idea is that it loosens the link between worry and the many moments that trigger it, and shows you that worry can be put off. Which part does the work has not been tested.',
    evidence: 'moderate',
    evidenceNote:
      'A two-week trial reduced worry, anxiety and insomnia. A meta-analysis of 7 trials found small effects on how long and how often people worried, compared with just logging worries. There are no long-term follow-ups yet.',
    refs: ['mcgowan2013', 'dippel2024'],
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
    name: 'Name the feeling',
    traits: ['N'],
    summary:
      'A few times a day, pause, notice what you are feeling without judging it, and name it in a word or two. If it helps, rate how strong it is and note what set it off.',
    how: 'In a brain-imaging study, putting a feeling into words calmed the brain\'s alarm response. Noticing feelings without judging them is also thought to show you that emotions pass, which may make you less likely to avoid them.',
    evidence: 'emerging',
    evidenceNote:
      'Mostly lab and brain-imaging evidence. Noticing feelings without judging them is one module of the Unified Protocol, a therapist-led CBT that, in one trial, lowered neuroticism in adults with anxiety disorders more than a waitlist or standard CBT. That trial tested the whole package, not this skill, and when it was pooled with a later trial, the package\'s edge over other CBT was small and not significant.',
    refs: ['lieberman2007', 'sauerzavala2021', 'lorenzoluaces2023'],
  },

  {
    id: 'skill-modeling',
    name: 'Learn from a calm role model',
    traits: ['N'],
    summary:
      'Notice how someone who handles stress well behaves in a specific situation, rehearse doing the same, and then try it yourself.',
    how: 'Copying a concrete behaviour from a role model gives you a ready-made alternative to your usual stress reaction, which can become a habit with practice.',
    evidence: 'emerging',
    evidenceNote:
      'Part of the behavioural habit package in one 6-week app trial (CHILL) that lowered self-reported neuroticism. The package was tested as a whole, so the effect of this one strategy is unknown.',
    refs: ['wright2026'],
  },
  {
    id: 'emotional-support',
    name: 'Reach out for support',
    traits: ['N'],
    summary: 'Talk regularly with people you trust about how you are doing, especially on stressful days.',
    how: 'Sharing stress with others can ease it in the moment and reminds you that support is available.',
    evidence: 'emerging',
    evidenceNote:
      'One of the in-the-moment strategies in a 6-week app trial (CHILL). In that trial, in-the-moment strategies lowered self-reported neuroticism at first, but the drop faded unless habit-building strategies were added.',
    refs: ['wright2026'],
  },

  // ── Conscientiousness ───────────────────────────────────────────────────
  {
    id: 'implementation-intentions',
    name: 'If-then plans',
    traits: ['C', 'A', 'E', 'O', 'N'],
    summary: 'Decide exactly when, where and how you will act: "If [situation], then I will [action]."',
    how: 'The plan links the action to a cue, so the cue triggers the behaviour without needing fresh willpower or memory.',
    evidence: 'strong',
    evidenceNote:
      'Strong for goal attainment: a meta-analysis of 94 tests found a medium-to-large effect (d = 0.65). In one 16-week student study, weekly coaching to write small concrete steps and if-then plans helped students who wanted to change gain more in self-reported extraversion, conscientiousness and emotional stability than controls, but not in agreeableness or openness. This has not been replicated, and in the same paper\'s first study, a vaguer "list three ways" plan did not help and may have backfired.',
    refs: ['gollwitzer2006', 'hudson2015'],
  },
  {
    id: 'woop',
    name: 'Picture the obstacle (WOOP)',
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
    name: 'Just start',
    traits: ['C'],
    summary:
      'Break an avoided task into a first step that takes 2–10 minutes, set a timer, and start. Note the thought that made you want to avoid it.',
    how: 'Starting is the hardest part. Once you begin, the task is rarely as aversive as predicted.',
    evidence: 'moderate',
    evidenceNote:
      'Tested as one part of whole CBT programmes, not on its own. Across 12 small trials, psychological treatments reduced self-reported procrastination compared with no treatment (CBT in three of them, with a larger effect). One internet CBT trial worked with and without a coach.',
    refs: ['rozental2018', 'rozental2015'],
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
      'For a set time, deliberately act more talkative, assertive, bold and active than usual. Skip situations where it would be out of place. If you\'re quite introverted and it starts to feel draining or fake, scale back.',
    how:
      'Acting more outgoing tends to lift your mood while you keep it up, and some studies find people also feel more connected. In one trial the lift came mainly from how people acted, not from more time with others, and it was gone two weeks after they stopped.',
    evidence: 'moderate',
    evidenceNote:
      'In week-long randomized experiments, acting extraverted raised positive mood and well-being, and in one, feelings of connection, but evidence for lasting trait change is limited. One trial found no costs on average, though more introverted people gained less, and the most introverted may have felt more tired, more negative and less authentic (tentative). A study that tracked people\'s days linked outgoing moments to tiredness about 3 hours later, but that trial did not find it, so plan recovery time mainly if you\'re quite introverted.',
    refs: ['fleeson2002', 'jacqueshamilton2019', 'margolis2020', 'vanallen2021', 'leikas2017'],
  },
  {
    id: 'talk-strangers',
    name: 'Talk to strangers',
    traits: ['E'],
    summary:
      'Start brief, genuine conversations with people you don\'t know or only know a little: baristas, neighbours, commuters, colleagues from other teams.',
    how:
      'People consistently underestimate how much they (and the other person) will enjoy these chats. Doing it corrects that pessimistic prediction and lowers fear of rejection.',
    evidence: 'moderate',
    evidenceNote:
      'Field experiments: commuters told to talk to a stranger had a more pleasant journey than they predicted. A week-long "talk to strangers" game reduced fear of rejection and increased confidence in conversation skills. Days with more weak-tie interactions go with more happiness, but no study has measured trait change yet.',
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
    how: 'It reduces resentment and the urge to get even toward someone who hurt you. The review measured forgiveness of that one hurt, not hostility in general or agreeableness.',
    evidence: 'moderate',
    evidenceNote:
      'A meta-analysis of 54 study reports found that in-person programs led by a therapist or trained facilitator, mostly in groups, increased forgiveness of a specific hurt, and the gains held at follow-ups of weeks to months. A smaller set of studies found less depression and anxiety, with smaller effects. Programs averaged about 10 hours, and longer ones had larger effects; self-guided versions like this one were not included.',
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
    name: 'Seek out novelty',
    traits: ['O'],
    summary:
      'Regularly try unfamiliar things: new foods, routes, places and activities, and also art, ideas and people with different views.',
    how: 'The idea is that regularly choosing the new over the familiar can become a habit that slowly shifts the trait. This is theory: what drives the change is not yet known.',
    evidence: 'emerging',
    evidenceNote:
      'In two 2-week text-message studies, people who chose to practise trying new activities reported a bigger rise in that narrow facet than people who chose self-discipline, and in the second study, friends and family also rated an increase within that group. But the groups were small and self-chosen, broader openness did not change, and art, ideas and other viewpoints were not targeted. In 12 pooled student studies, a stronger wish to become more open went with only slightly more growth in self-rated openness (about 0.04 SD over 16 weeks), the smallest goal effect of the five traits.',
    refs: ['stieger2020', 'hudson2020'],
  },
  {
    id: 'cognitive-training',
    name: 'Puzzles',
    traits: ['O'],
    summary:
      'Regularly work on reasoning exercises (such as spotting the pattern in a series) plus crosswords or sudoku, at a level that challenges you without overwhelming you. Learning a demanding new skill follows the same idea but has not been tested.',
    how: 'Regular mental challenges pitched at your level may make ideas more appealing and shift how you see yourself. In the study, better reasoning scores did not explain the rise in openness, and other possible reasons were not tested.',
    evidence: 'emerging',
    evidenceNote:
      'One randomized trial in adults aged 60–94: about 16 weeks of home reasoning training plus crosswords and sudoku, at least 10 hours a week, raised self-reported openness compared with a waitlist (d = 0.39). Other Big Five traits did not change. Participants did little work or volunteering, and the authors say this should be weighed before applying the result to other people.',
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
