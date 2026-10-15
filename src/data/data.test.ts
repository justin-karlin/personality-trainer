import { describe, expect, it } from 'vitest';
import { TRAIT_IDS } from '../types';
import { CHALLENGES } from './challenges';
import { REFERENCES, REFERENCE_LIST } from './references';
import { TECHNIQUES } from './techniques';
import { TRAITS } from './traits';

describe('content integrity', () => {
  it('has unique ids', () => {
    for (const list of [CHALLENGES, TECHNIQUES, REFERENCE_LIST]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('links every challenge to a technique that covers its trait', () => {
    for (const c of CHALLENGES) {
      const t = TECHNIQUES.find((x) => x.id === c.technique);
      expect(t, `${c.id} → ${c.technique}`).toBeDefined();
      expect(t!.traits, `${c.id} trait ${c.trait}`).toContain(c.trait);
    }
  });

  it('offers every trait challenges at all three levels', () => {
    for (const trait of TRAIT_IDS) {
      for (const level of [1, 2, 3]) {
        expect(CHALLENGES.some((c) => c.trait === trait && c.level === level), `${trait} L${level}`).toBe(true);
      }
    }
  });

  it('gives every challenge usable guidance', () => {
    for (const c of CHALLENGES) {
      expect(c.instructions.length).toBeGreaterThan(30);
      expect(c.ifThenExample).toMatch(/^If .+, then /);
      expect(c.perWeek).toBeGreaterThanOrEqual(1);
      expect(c.perWeek).toBeLessThanOrEqual(7);
    }
  });

  it('only cites references that exist', () => {
    const cited = [...TECHNIQUES.flatMap((t) => t.refs), ...Object.values(TRAITS).flatMap((t) => t.refs)];
    // Also scan the UI and coach sources for refs={[...]}, refs: [...] and ids={[...]}.
    const sources = import.meta.glob(['../pages/*.tsx', '../lib/coach.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    for (const text of Object.values(sources)) {
      for (const m of text.matchAll(/(?:refs|ids)(?:=\{|:\s*)\[([^\]]*)\]/g)) {
        cited.push(...[...m[1].matchAll(/'([a-z0-9]+)'/g)].map((x) => x[1]));
      }
    }
    expect(cited.length).toBeGreaterThan(50);
    for (const id of cited) expect(REFERENCES[id], `missing reference ${id}`).toBeDefined();
  });
});

describe('goal focus', () => {
  it('offers follow-through and getting along, and keeps goals people already have', async () => {
    const { offeredTraits } = await import('../types');
    expect(offeredTraits([])).toEqual(['C', 'A']);
    expect(offeredTraits(['E'])).toEqual(['C', 'A', 'E']);
  });
});

describe('barriers', () => {
  it('point only at follow-through challenges that exist', async () => {
    const { BARRIERS } = await import('./barriers');
    const { challengeById } = await import('./challenges');
    for (const b of BARRIERS) {
      expect(b.challenges.length, b.id).toBeGreaterThan(0);
      for (const id of b.challenges) expect(challengeById(id)?.trait, `${b.id}: ${id}`).toBe('C');
    }
  });
});
