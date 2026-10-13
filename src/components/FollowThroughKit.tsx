import { useState } from 'react';
import type { AppState } from '../types';
import { TRAITS } from '../data/traits';
import { challengeById } from '../data/challenges';
import { buildDailyReminderIcs, parseTime } from '../lib/calendar';
import { addDays, daysBetween } from '../lib/dates';
import { pathEndDate } from '../lib/path';
import { currentWeekIndex, findWeek } from '../lib/program';
import { RefList } from './common';
import { Icon } from './Icon';

const CLOSED_KEY = 'trait-trainer:kit-closed';

function wasClosed(): boolean {
  try {
    return localStorage.getItem(CLOSED_KEY) === '1';
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

  function downloadReminder() {
    if (!timeOk) return;
    const ics = buildDailyReminderIcs({
      title: 'Trait Trainer: today\'s plan',
      description: [
        'Open Trait Trainer, look at today\'s if-then plans and log your check-in.',
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
    setReminderStatus('Reminder downloaded. Open the file to add it to your calendar.');
  }

  const message =
    `For the next few weeks I'm working on a goal: ${goals.join(' and ') || 'a personality goal'}.` +
    (plans.length ? ` This week I'm doing: ${plans.join('; ')}.` : '') +
    ' Could you ask me how it\'s going at the end of the week?';

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus('Copied. Paste it into a message.');
    } catch {
      setStatus('Couldn\'t copy automatically. Select the text above and copy it.');
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
            localStorage.setItem(CLOSED_KEY, '1');
          } catch {
            // Private mode or blocked storage: the kit just reopens next time.
          }
        }
      }}
    >
      <summary>
        <span>
          <h2>Follow-through kit</h2>
          <small className="muted">Reminders, a check-in buddy and a plan for missed days</small>
        </span>
        <span className="chev">
          <Icon name="back" size={20} stroke={2.2} className="chev-icon" />
        </span>
      </summary>
      <div style={{ marginTop: 10 }}>
        <p className="muted" style={{ margin: '0 0 16px' }}>
          The people who keep practising are the ones who change most. These tools add structure, so sticking with it
          depends less on willpower.
        </p>

        <div className="kit-step">
          <h3>1. A daily reminder</h3>
          <p style={{ margin: '0 0 6px' }}>
            Put a 10-minute daily reminder in your own calendar. Across app trials, those that sent reminders lost
            fewer participants.
          </p>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <span>Reminder time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <button onClick={downloadReminder} disabled={!timeOk}>
              Add to calendar (.ics)
            </button>
          </div>
          <small role="status" aria-live="polite" style={{ color: 'var(--accent-on-soft)', fontWeight: 600 }}>
            {timeOk ? reminderStatus : 'Enter a time first.'}
          </small>
          <small className="muted">
            Daily until about 3 months after your program ends. In Google Calendar, turn on a notification for the
            event after importing it. To change the time later, delete the old reminder first.
          </small>
          <RefList ids={['linardon2020']} />
        </div>

        <div className="kit-step">
          <h3>2. Someone who checks in</h3>
          <p style={{ margin: '0 0 6px' }}>
            Tell one person you trust what you're working on and ask them to check in. Online programs with some human
            guidance helped people complete more of them, and a friend is the nearest thing this app can offer.
          </p>
          <blockquote className="message">{message}</blockquote>
          <div className="row">
            <button onClick={copy}>Copy message</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && <button onClick={share}>Share…</button>}
          </div>
          <small role="status" aria-live="polite" style={{ color: 'var(--accent-on-soft)', fontWeight: 600 }}>
            {status}
          </small>
          <RefList ids={['musiat2022']} />
        </div>

        <div className="kit-step">
          <h3>3. A plan for missed days</h3>
          <p style={{ margin: 0 }}>
            Decide now: "If I miss a day, then the next day I'll do the smallest version of one challenge." Missing once
            didn't derail habit-building in the classic habit study. Coming back is what counts.
          </p>
          <RefList ids={['lally2010']} />
        </div>
      </div>
    </details>
  );
}
