import type { TraitId } from '../types';

// Observer versions of the IPIP-50 items for the two focus traits (Goldberg, 1992;
// public domain). Rephrasing IPIP items in the third person is the usual way to
// collect informant reports. Scores use the same 1–5 scale and keys as the self-report.
export const OBSERVER_ITEMS: Partial<Record<TraitId, [string, 1 | -1][]>> = {
  C: [
    ['Is always prepared.', 1],
    ['Leaves their belongings around.', -1],
    ['Pays attention to details.', 1],
    ['Makes a mess of things.', -1],
    ['Gets chores done right away.', 1],
    ['Often forgets to put things back in their proper place.', -1],
    ['Likes order.', 1],
    ['Shirks their duties.', -1],
    ['Follows a schedule.', 1],
    ['Is exacting in their work.', 1],
  ],
  A: [
    ['Feels little concern for others.', -1],
    ['Is interested in people.', 1],
    ['Insults people.', -1],
    ["Sympathizes with others' feelings.", 1],
    ["Is not interested in other people's problems.", -1],
    ['Has a soft heart.', 1],
    ['Is not really interested in others.', -1],
    ['Takes time out for others.', 1],
    ["Feels others' emotions.", 1],
    ['Makes people feel at ease.', 1],
  ],
};

/** The behaviour the "have they changed?" question asks about, per trait. */
export const CHANGE_PHRASE: Partial<Record<TraitId, string>> = {
  C: 'organized and reliable, following through on what they say they will do',
  A: 'patient, considerate and cooperative with other people',
};

export const RATED_TRAITS = Object.keys(OBSERVER_ITEMS) as TraitId[];

export const RELATIONS = ['Partner', 'Friend', 'Family member', 'Colleague', 'Other'] as const;

export const CHANGE_LABELS = ['Much less', 'A bit less', 'About the same', 'A bit more', 'Much more'];
