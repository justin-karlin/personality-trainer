import { describe, expect, it } from 'vitest';
import { REFERENCES } from './references';
import { SCENES } from './scenes';
import { SCIENCE_CARDS } from './scienceCards';

const MOTION_CLASS = /^(m-[a-z-]+|o-(b|t|l|r|bl|br|tl|tr)|d(1|2|3|4|5|6|7|8|9|10|12|15)|px-(far|near|front))$/;

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
      const svg = SCENES[c.scene];
      expect(svg, c.scene).toBeDefined();
      expect(svg.length, c.scene).toBeLessThanOrEqual(12288);
      expect(svg, c.scene).toMatch(/^<svg [^>]*viewBox="0 0 400 260"[^>]*aria-hidden="true"/);
      // Colours come from CSS variables so the art follows light and dark mode; no text or scripts.
      expect(svg.replace(/url\(#[\w-]+\)/g, ''), c.scene).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|<text|<script|<style|<image|<use|href=|\son\w+=/i);
      // ids are shared by every scene on the page, so each is prefixed with its scene name.
      for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) expect(id, c.scene).toMatch(new RegExp(`^${c.scene}-`));
      for (const [, cls] of svg.matchAll(/\sclass="([^"]+)"/g))
        for (const name of cls.split(/\s+/)) expect(name, `${c.scene}: ${name}`).toMatch(MOTION_CLASS);
    }
    expect(Object.keys(SCENES).length).toBe(SCIENCE_CARDS.length);
  });
});
