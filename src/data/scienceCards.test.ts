import { describe, expect, it } from 'vitest';
import { REFERENCES } from './references';
import { SCIENCE_CARDS } from './scienceCards';

const SCENES = import.meta.glob('../assets/scenes/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('science cards', () => {
  it('has unique ids and scenes', () => {
    expect(new Set(SCIENCE_CARDS.map((c) => c.id)).size).toBe(SCIENCE_CARDS.length);
    expect(new Set(SCIENCE_CARDS.map((c) => c.scene)).size).toBe(SCIENCE_CARDS.length);
  });

  it('cites known references on every card', () => {
    for (const c of SCIENCE_CARDS) {
      expect(c.refs.length, c.id).toBeGreaterThan(0);
      for (const r of c.refs) expect(REFERENCES[r], `${c.id} → ${r}`).toBeDefined();
    }
  });

  it('keeps the headline short enough to read at a glance', () => {
    for (const c of SCIENCE_CARDS) {
      expect(c.fact.length, c.id).toBeLessThanOrEqual(60);
      expect(c.detail.length, c.id).toBeLessThanOrEqual(200);
    }
  });

  it('has a theme-aware illustration for every card', () => {
    for (const c of SCIENCE_CARDS) {
      const svg = SCENES[`../assets/scenes/${c.scene}.svg`];
      expect(svg, c.scene).toBeDefined();
      expect(svg.length, c.scene).toBeLessThan(4096);
      expect(svg, c.scene).toMatch(/^<svg [^>]*viewBox="0 0 400 260"[^>]*aria-hidden="true"/);
      // Colours come from CSS variables so the art follows light and dark mode; no text or scripts.
      expect(svg, c.scene).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|<text|<script|<style|<image|href=|on\w+=/i);
    }
    expect(Object.keys(SCENES).length).toBe(SCIENCE_CARDS.length);
  });
});
