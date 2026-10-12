import { describe, expect, it } from 'vitest';
import { buildDailyReminderIcs, escapeIcsText, foldIcsLine } from './calendar';

const now = new Date(Date.UTC(2026, 9, 12, 9, 30, 0));

describe('calendar reminder', () => {
  it('builds a daily recurring event at a floating local time', () => {
    const ics = buildDailyReminderIcs({
      title: 'Trait Trainer check-in',
      description: 'Why: I want to keep promises',
      startDate: '2026-10-13',
      time: '8:05',
      days: 70,
      now,
    });
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261013T080500');
    expect(lines).toContain('RRULE:FREQ=DAILY;COUNT=70');
    expect(lines).toContain('DTSTAMP:20261012T093000Z');
    expect(lines).toContain('TRIGGER:PT0M');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes special characters and line breaks', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });

  it('folds long lines to 75 octets without splitting characters', () => {
    const long = 'DESCRIPTION:' + 'é'.repeat(80);
    const folded = foldIcsLine(long).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const l of folded) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long);
  });
});
