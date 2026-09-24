import type { AssessmentItem, TraitId } from '../types';

// IPIP 50-item Big-Five Factor Markers (Goldberg, 1992), public domain
// (https://ipip.ori.org). Items appear in the standard interleaved order.
// IPIP keys the fourth factor as Emotional Stability; here it is keyed as
// Neuroticism (N), so the published +/- keys for those items are flipped.
const RAW: [string, TraitId, 1 | -1][] = [
  ['Am the life of the party.', 'E', 1],
  ['Feel little concern for others.', 'A', -1],
  ['Am always prepared.', 'C', 1],
  ['Get stressed out easily.', 'N', 1],
  ['Have a rich vocabulary.', 'O', 1],
  ["Don't talk a lot.", 'E', -1],
  ['Am interested in people.', 'A', 1],
  ['Leave my belongings around.', 'C', -1],
  ['Am relaxed most of the time.', 'N', -1],
  ['Have difficulty understanding abstract ideas.', 'O', -1],
  ['Feel comfortable around people.', 'E', 1],
  ['Insult people.', 'A', -1],
  ['Pay attention to details.', 'C', 1],
  ['Worry about things.', 'N', 1],
  ['Have a vivid imagination.', 'O', 1],
  ['Keep in the background.', 'E', -1],
  ["Sympathize with others' feelings.", 'A', 1],
  ['Make a mess of things.', 'C', -1],
  ['Seldom feel blue.', 'N', -1],
  ['Am not interested in abstract ideas.', 'O', -1],
  ['Start conversations.', 'E', 1],
  ["Am not interested in other people's problems.", 'A', -1],
  ['Get chores done right away.', 'C', 1],
  ['Am easily disturbed.', 'N', 1],
  ['Have excellent ideas.', 'O', 1],
  ['Have little to say.', 'E', -1],
  ['Have a soft heart.', 'A', 1],
  ['Often forget to put things back in their proper place.', 'C', -1],
  ['Get upset easily.', 'N', 1],
  ['Do not have a good imagination.', 'O', -1],
  ['Talk to a lot of different people at parties.', 'E', 1],
  ['Am not really interested in others.', 'A', -1],
  ['Like order.', 'C', 1],
  ['Change my mood a lot.', 'N', 1],
  ['Am quick to understand things.', 'O', 1],
  ["Don't like to draw attention to myself.", 'E', -1],
  ['Take time out for others.', 'A', 1],
  ['Shirk my duties.', 'C', -1],
  ['Have frequent mood swings.', 'N', 1],
  ['Use difficult words.', 'O', 1],
  ["Don't mind being the center of attention.", 'E', 1],
  ["Feel others' emotions.", 'A', 1],
  ['Follow a schedule.', 'C', 1],
  ['Get irritated easily.', 'N', 1],
  ['Spend time reflecting on things.', 'O', 1],
  ['Am quiet around strangers.', 'E', -1],
  ['Make people feel at ease.', 'A', 1],
  ['Am exacting in my work.', 'C', 1],
  ['Often feel blue.', 'N', 1],
  ['Am full of ideas.', 'O', 1],
];

export const IPIP50: AssessmentItem[] = RAW.map(([text, trait, key], i) => ({ id: `ipip${i + 1}`, text, trait, key }));

// PHQ-4 (Kroenke et al., 2009): an ultra-brief anxiety/depression screen that
// is free to use. Items 1–2 are the GAD-2 (anxiety), 3–4 the PHQ-2 (depression).
// A subscale score of 3 or more suggests a professional evaluation.
export const PHQ4_STEM = 'Over the last 2 weeks, how often have you been bothered by the following problems?';
export const PHQ4_ITEMS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
];
export const PHQ4_OPTIONS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
export const PHQ4_CUTOFF = 3;
