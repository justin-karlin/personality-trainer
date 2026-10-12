import { useState } from 'react';
import type { AppState } from '../types';
import { TRAITS } from '../data/traits';
import { challengeById } from '../data/challenges';
import { buildDailyReminderIcs } from '../lib/calendar';
import { addDays, daysBetween } from '../lib/dates';
import { currentWeekIndex, findWeek } from '../lib/program';
import { RefList } from './common';

/**
 * Structure that stands in for conscientiousness: a calendar reminder, a
 * friend who checks in, and a plan for missed days. No study has tested
 * building conscientiousness first to reduce dropout, so the app lends
 * structure instead (see the Science page).
 */
export function FollowThroughKit({ state, date, open }: { state: AppState; date: string; open: boolean }) {
  const [time, setTime] = useState('08:00');
  const [copied, setCopied] = useState('');
  const goals = state.goals.map((g) => TRAITS[g.trait].goalName.toLowerCase());
  const idx = currentWeekIndex(state, date);
  const week = idx == null ? undefined : findWeek(state, idx);
  const plans = (week?.commitments ?? []).map((c) => challengeById(c.challengeId)?.title).filter(Boolean);
  const programEnd = state.startDate ? addDays(state.startDate, state.programWeeks * 7) : date;
  const days = Math.max(7, daysBetween(date, programEnd));

  function downloadReminder() {
    const ics = buildDailyReminderIcs({
      title: 'Trait Trainer: today\'s plan',
      description: [
        'Open Trait Trainer, look at today\'s if-then plans and log your check-in.',
        ...state.goals.map((g) => `${TRAITS[g.trait].goalName}. Why: ${g.why}`),
      ].join('\n'),
      startDate: addDays(date, 1),
      time,
      days,
      now: new Date(),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trait-trainer-reminder.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  const message =
    `For the next few weeks I'm working on a goal: ${goals.join(' and ') || 'a personality goal'}.` +
    (plans.length ? ` This week I'm doing: ${plans.join('; ')}.` : '') +
    ' Could you ask me how it\'s going at the end of the week?';

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        setCopied('Shared.');
      } else {
        await navigator.clipboard.writeText(message);
        setCopied('Copied. Paste it into a message.');
      }
    } catch {
      setCopied('Couldn\'t copy automatically. Select the text above and copy it.');
    }
  }

  return (
    <details className="card" open={open} style={{ marginTop: 16 }}>
      <summary>
        <strong>Follow-through kit</strong>
        <small className="muted"> · reminders, a check-in buddy and a plan for missed days</small>
      </summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <p className="muted" style={{ margin: 0 }}>
          The people who keep practising are the ones who change most. These tools add structure, so sticking with it
          depends less on willpower.
        </p>

        <div>
          <h3 style={{ margin: '4px 0' }}>1. A daily reminder</h3>
          <p style={{ margin: '0 0 6px' }}>
            Put a 10-minute daily reminder in your own calendar. Across app trials, those that sent reminders lost
            fewer participants.
          </p>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <span>Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value || '08:00')} />
            </label>
            <button onClick={downloadReminder}>Add to calendar (.ics)</button>
          </div>
          <RefList ids={['linardon2020']} />
        </div>

        <div>
          <h3 style={{ margin: '4px 0' }}>2. Someone who checks in</h3>
          <p style={{ margin: '0 0 6px' }}>
            Tell one person you trust what you're working on and ask them to check in. Online programs with some human
            guidance helped people complete more of them, and a friend is the nearest thing this app can offer.
          </p>
          <blockquote className="muted" style={{ margin: '0 0 6px' }}>
            {message}
          </blockquote>
          <button onClick={share}>Share or copy this message</button> {copied && <small>{copied}</small>}
          <RefList ids={['musiat2022']} />
        </div>

        <div>
          <h3 style={{ margin: '4px 0' }}>3. A plan for missed days</h3>
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
