import type { BarrierId } from '../types';

// What gets in the way of following through, and a small response matched to each.
// These pairings are CBT-informed product suggestions in the spirit of structured
// procrastination treatment (rozental2018): the treatments were tested as whole
// programs, so no single pairing here has been tested on its own.

export interface Barrier {
  id: BarrierId;
  /** How the user would say it. */
  label: string;
  /** The matched response, as a short instruction. */
  response: string;
  /** Challenges that fit this barrier, best first. */
  challenges: string[];
}

export const BARRIERS: Barrier[] = [
  {
    id: 'unclear',
    label: "It's not clear what to do first",
    response: 'Make the first step concrete, like "open the file".',
    challenges: ['c-tomorrow', 'c-woop', 'c-time-block'],
  },
  {
    id: 'too-big',
    label: 'It feels too big',
    response: 'Shrink the first step to under 10 minutes.',
    challenges: ['c-just-start', 'c-tiny-habit', 'c-backlog'],
  },
  {
    id: 'distraction',
    label: 'I get distracted',
    response: 'Remove one distraction first, like your phone.',
    challenges: ['c-phone-away', 'c-finish', 'c-reset'],
  },
  {
    id: 'perfectionism',
    label: 'I want it to be perfect',
    response: 'Aim for a rough first pass; polish later.',
    challenges: ['c-rough-pass', 'c-just-start', 'c-finish'],
  },
  {
    id: 'discomfort',
    label: 'It feels unpleasant or stressful',
    response: 'Name the feeling, then do a small piece anyway.',
    challenges: ['c-just-start', 'c-bundle', 'c-rough-pass'],
  },
  {
    id: 'forgetting',
    label: 'I forget or lose track',
    response: 'Tie it to a daily cue, like finishing breakfast.',
    challenges: ['c-tomorrow', 'c-tiny-habit', 'c-planned-vs-done', 'c-home-for-things'],
  },
  {
    id: 'other',
    label: 'Something else',
    response: 'Name it, then pick a challenge with a smaller first step.',
    challenges: ['c-just-start', 'c-tomorrow'],
  },
];

export function barrierById(id: BarrierId | undefined): Barrier | undefined {
  return BARRIERS.find((b) => b.id === id);
}
