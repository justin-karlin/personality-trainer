import { describe, expect, it } from 'vitest';
import { REFERENCES } from './references';
import { SCIENCE_CARDS, type Viz } from './scienceCards';

describe('science cards', () => {
  it('has unique ids', () => {
    expect(new Set(SCIENCE_CARDS.map((c) => c.id)).size).toBe(SCIENCE_CARDS.length);
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

  it('gives every chart a study note and a text alternative', () => {
    for (const c of SCIENCE_CARDS) {
      expect(c.note.length, c.id).toBeGreaterThan(5);
      expect(c.alt.length, c.id).toBeGreaterThan(20);
    }
  });

  it('has well-formed chart data', () => {
    const check = (id: string, v: Viz) => {
      switch (v.kind) {
        case 'bars':
          if (v.domain) for (const r of v.rows) expect(r.value >= v.domain[0] && r.value <= v.domain[1], id).toBe(true);
          expect(v.rows.length, id).toBeGreaterThanOrEqual(2);
          expect(v.rows.length, id).toBeLessThanOrEqual(4);
          for (const r of v.rows) expect(Number.isFinite(r.value), id).toBe(true);
          expect(v.rows.some((r) => r.emphasis), id).toBe(true);
          break;
        case 'line':
          for (const s of v.series) expect(s.values.length, id).toBe(v.xLabels.length);
          for (const p of v.labelPoints ?? []) expect(v.series[p.series]?.values[p.index], id).not.toBeNull();
          break;
        case 'range':
          expect(v.min.value, id).toBeLessThanOrEqual(v.mean.value);
          expect(v.mean.value, id).toBeLessThanOrEqual(v.max.value);
          expect(v.max.value, id).toBeLessThanOrEqual(v.axisMax);
          break;
        case 'stat':
          if (v.scale) expect(v.scale.value, id).toBeGreaterThanOrEqual(0);
          break;
        case 'streak':
          expect(v.days, id).toMatch(/^[x-]{5,16}$/);
          break;
        case 'compare':
          break;
      }
    };
    for (const c of SCIENCE_CARDS) check(c.id, c.viz);
  });
});
