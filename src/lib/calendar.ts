// A daily calendar reminder as an iCalendar (.ics) file. The app has no server
// and can't send notifications, so a reminder in the user's own calendar is the
// most reliable prompt it can offer. Times are "floating" (no time zone): Apple
// Calendar keeps them at local time while travelling, while Google and Outlook
// pin them to the calendar's time zone on import. Google's .ics import also
// ignores alarms, so the app asks Google users to turn on a notification.

export interface ReminderOptions {
  title: string;
  description: string;
  /** First day, yyyy-mm-dd. */
  startDate: string;
  /** Local time, HH:MM (24-hour). */
  time: string;
  /** Number of daily occurrences. */
  days: number;
  /** Stable id for this user's reminder, so a re-download updates rather than duplicates where calendars allow. */
  uid: string;
  /** Creation timestamp, used for DTSTAMP and SEQUENCE. */
  now: Date;
}

/** Parse a 24-hour "H:MM" or "HH:MM" time, or return null if it isn't one. */
export function parseTime(t: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? [h, min] : null;
}

/** Escape text for an iCalendar TEXT value (RFC 5545 §3.3.11). */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line to at most 75 octets per line (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildDailyReminderIcs(o: ReminderOptions): string {
  const t = parseTime(o.time);
  if (!t) throw new Error(`Invalid reminder time: ${o.time}`);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${o.startDate.replace(/-/g, '')}T${pad(t[0])}${pad(t[1])}00`;
  const stamp = utcStamp(o.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trait Trainer//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${o.uid}@trait-trainer.local`,
    `SEQUENCE:${Math.floor(o.now.getTime() / 1000)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    'DURATION:PT10M',
    `RRULE:FREQ=DAILY;COUNT=${Math.max(1, Math.round(o.days))}`,
    `SUMMARY:${escapeIcsText(o.title)}`,
    `DESCRIPTION:${escapeIcsText(o.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(o.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
