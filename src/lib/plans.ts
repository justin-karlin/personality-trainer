// Gentle checks on a user's if-then plan. In Hudson & Fraley (2015), vague
// weekly plans ("be more sociable") did not help, while coaching people to
// name a concrete cue and a concrete step did. These are hints, never blockers.

const CUE = /\b(if|when|whenever|after|before|once|as soon as|at \d|on (mon|tues|wednes|thurs|fri|satur|sun)day)/i;
const ACTION = /\b(then|i'll|i will|i'm going to)\b/i;
const TRAIT_WORDS =
  /^(?:.*\bthen\b)?\s*(?:i'll|i will)?\s*(?:be|become|act|try to be)\s+(?:more|less)\s+(?:organi[sz]ed|sociable|outgoing|kind|nice|nicer|calm|calmer|open|curious|confident|responsible|patient|friendly)\.?\s*$/i;

export function planHint(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length < 20) return 'Add detail: when and where will you do it, and what exactly will you do?';
  if (!CUE.test(t)) return 'Start with a cue you will notice: "If it\'s 8am and…", "When I get home…", "After lunch…".';
  if (!ACTION.test(t)) return 'Name the action: "…then I\'ll [a specific step]".';
  if (TRAIT_WORDS.test(t)) return 'Make the action a concrete step you can see, not a trait ("then I\'ll ask one question", not "be more outgoing").';
  return null;
}
