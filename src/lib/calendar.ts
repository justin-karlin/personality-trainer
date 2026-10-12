// A daily calendar reminder as an iCalendar (.ics) file. The app has no server
// and can't send notifications, so a reminder in the user's own calendar is the
// most reliable prompt it can offer. Times are "floating" (no time zone), so the
// event fires at the chosen local time wherever the user is.

export interface ReminderOptions {
  title: string;
  description: string;
  /** First day, yyyy-mm-dd. */
  startDate: string;
  /** Local time, HH:MM (24-hour). */
  time: string;
  /** Number of daily occurrences. */
  days: number;
  /** Creation timestamp, used for DTSTAMP and the UID. */
  now: Date;
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
  const [hh, mm] = o.time.split(':');
  const start = `${o.startDate.replace(/-/g, '')}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`;
  const stamp = utcStamp(o.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trait Trainer//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:trait-trainer-${stamp}-${start}@trait-trainer.local`,
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
