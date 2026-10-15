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
    response: 'Define the first step you could see someone do, like "open the file and write the heading", not "work on the report".',
    challenges: ['c-tomorrow', 'c-woop', 'c-time-block'],
  },
  {
    id: 'too-big',
    label: 'It feels too big',
    response: 'Shrink the first step until it takes 2–10 minutes. Stopping after it still counts.',
    challenges: ['c-just-start', 'c-tiny-habit', 'c-backlog'],
  },
  {
    id: 'distraction',
    label: 'I get distracted',
    response: 'Before you start, remove one specific distraction: phone in another room, one tab open, door closed.',
    challenges: ['c-phone-away', 'c-finish', 'c-reset'],
  },
  {
    id: 'perfectionism',
    label: 'I want it to be perfect',
    response: 'Aim for a deliberately rough first pass. Polishing is a separate, later step.',
    challenges: ['c-rough-pass', 'c-just-start', 'c-finish'],
  },
  {
    id: 'discomfort',
    label: 'It feels unpleasant or stressful',
    response:
      "Notice the feeling and name it (\"dread\", \"boredom\"). Then do a small piece anyway; the feeling doesn't have to go away first.",
    challenges: ['c-just-start', 'c-bundle', 'c-rough-pass'],
  },
  {
    id: 'forgetting',
    label: 'I forget or lose track',
    response: 'Tie the action to a cue you meet anyway (finishing breakfast, closing the laptop), or set a reminder.',
    challenges: ['c-tomorrow', 'c-tiny-habit', 'c-planned-vs-done', 'c-home-for-things'],
  },
  {
    id: 'other',
    label: 'Something else',
    response: 'Name it in a few words, then pick a challenge that makes the first step smaller or easier to start.',
    challenges: ['c-just-start', 'c-tomorrow'],
  },
];

export function barrierById(id: BarrierId | undefined): Barrier | undefined {
  return BARRIERS.find((b) => b.id === id);
}
