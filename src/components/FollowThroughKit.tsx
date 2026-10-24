import { useState } from 'react';
import type { AppState } from '../types';
import { TRAITS } from '../data/traits';
import { challengeById } from '../data/challenges';
import { buildDailyReminderIcs, parseTime } from '../lib/calendar';
import { isNative, scheduleDailyReminder } from '../lib/native';
import { addDays, daysBetween } from '../lib/dates';
import { pathEndDate } from '../lib/path';
import { currentWeekIndex, findWeek } from '../lib/program';
import { Icon } from './Icon';
import { durable } from '../lib/durable';

const CLOSED_KEY = 'trait-trainer:kit-closed';

function wasClosed(): boolean {
  try {
    return durable.getItem(CLOSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Structure that stands in for conscientiousness: a calendar reminder, a
 * friend who checks in, and a plan for missed days. No study has tested
 * building conscientiousness first to reduce dropout, so the app lends
 * structure instead (see the Science page).
 */
export function FollowThroughKit({ state, date, open }: { state: AppState; date: string; open: boolean }) {
  // Auto-open only until the user has collapsed the kit once.
  const [initiallyOpen] = useState(() => open && !wasClosed());
  const [time, setTime] = useState('08:00');
  const [status, setStatus] = useState('');
  const [reminderStatus, setReminderStatus] = useState('');
  const timeOk = parseTime(time) != null;
  const goals = state.goals.map((g) => TRAITS[g.trait].goalName.toLowerCase());
  const idx = currentWeekIndex(state, date);
  const week = idx == null ? undefined : findWeek(state, idx);
  const plans = (week?.commitments ?? []).map((c) => challengeById(c.challengeId)?.title).filter(Boolean);
  // Daily until each goal has finished its path, then about 3 months of maintenance.
  const days = Math.max(0, daysBetween(date, pathEndDate(state) ?? date)) + 90;

  async function phoneReminder() {
    const t = parseTime(time);
    if (!t) return;
    const ok = await scheduleDailyReminder(t[0], t[1], 'Time for today\'s if-then plans and a 20-second check-in.');
    setReminderStatus(ok ? `Done. Daily at ${time}.` : 'Notifications are off. Turn them on in Settings.');
  }

  function downloadReminder() {
    if (!timeOk) return;
    const ics = buildDailyReminderIcs({
      title: 'Trait5: today\'s plan',
      description: [
        'Open Trait5, look at today\'s if-then plans and log your check-in.',
        ...state.goals.map((g) => `${TRAITS[g.trait].goalName}. Why: ${g.why}`),
      ].join('\n'),
      startDate: addDays(date, 1),
      time,
      days,
      uid: `reminder-${state.startDate ?? date}`,
      now: new Date(),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trait-trainer-reminder.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Some browsers (Safari) read the file after click returns, so revoke later.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setReminderStatus('Downloaded. Open it to add to your calendar.');
  }

  const message =
    `For the next few weeks I'm working on a goal: ${goals.join(' and ') || 'a personality goal'}.` +
    (plans.length ? ` This week I'm doing: ${plans.join('; ')}.` : '') +
    ' Could you ask me how it\'s going at the end of the week?';

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus('Copied.');
    } catch {
      setStatus('Couldn\'t copy. Select the text and copy it.');
    }
  }

  async function share() {
    try {
      await navigator.share({ text: message });
      setStatus('Shared.');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus(''); // the user closed the share sheet
        return;
      }
      await copy();
    }
  }

  return (
    <details
      className="card kit"
      open={initiallyOpen}
      style={{ marginTop: 16 }}
      onToggle={(e) => {
        if (!e.currentTarget.open) {
          try {
            durable.setItem(CLOSED_KEY, '1');
          } catch {
            // Private mode or blocked storage: the kit just reopens next time.
          }
        }
      }}
    >
      <summary>
        <span>
          <h2>Follow-through kit</h2>
          <span className="muted" style={{ display: 'block', fontWeight: 500 }}>
            Reminder, buddy, backup plan
          </span>
        </span>
        <span className="chev">
          <Icon name="back" size={20} stroke={2.2} className="chev-icon" />
        </span>
      </summary>
      <div style={{ marginTop: 10 }}>
        <div className="kit-step">
          <h3>1. Daily reminder</h3>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <span>Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            {isNative() ? (
              <button onClick={() => void phoneReminder()} disabled={!timeOk}>
                Remind me daily
              </button>
            ) : (
              <button onClick={downloadReminder} disabled={!timeOk}>
                Add to calendar (.ics)
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" style={{ margin: '4px 0 0', color: 'var(--accent-on-soft)', fontWeight: 600 }}>
            {timeOk ? reminderStatus : 'Enter a time.'}
          </p>
          {!isNative() && <p className="muted" style={{ margin: '4px 0 0' }}>To change the time, delete the old one first.</p>}
        </div>

        <div className="kit-step">
          <h3>2. A buddy</h3>
          <p style={{ margin: '0 0 6px' }}>Ask someone to check in weekly.</p>
          <blockquote className="message">{message}</blockquote>
          <div className="row">
            <button onClick={copy}>Copy message</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && <button onClick={share}>Share…</button>}
          </div>
          <p role="status" aria-live="polite" style={{ margin: '4px 0 0', color: 'var(--accent-on-soft)', fontWeight: 600 }}>
            {status}
          </p>
        </div>

        <div className="kit-step">
          <h3>3. Missed a day?</h3>
          <p style={{ margin: 0 }}>Next day, do the smallest version of one challenge.</p>
        </div>
      </div>
    </details>
  );
}
