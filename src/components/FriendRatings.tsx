import { useState } from 'react';
import { useStore } from '../store';
import { TRAITS } from '../data/traits';
import { CHANGE_LABELS, RATED_TRAITS } from '../data/observer';
import { appUrl, decodeReply, encodeRequest, ratersFor, toObserverRating } from '../lib/observer';
import { formatDate, today } from '../lib/dates';
import type { ObserverRating, SentRatingRequest, TraitId } from '../types';
import { RefList } from './common';

const newId = () => Math.random().toString(36).slice(2, 10);

/** Add a friend's reply (from a link or pasted code) to the user's data. */
export function useAddRating() {
  const { state, update } = useStore();
  return (text: string): ObserverRating => {
    const rating = toObserverRating(decodeReply(text));
    if ((state.observerRatings ?? []).some((r) => r.id === rating.id)) throw new Error('You’ve already added this rating.');
    update((s) => ({ ...s, observerRatings: [...(s.observerRatings ?? []), rating] }));
    return rating;
  };
}

/** Ask people who know you to rate you, add their replies, and compare their view with yours. */
export function FriendRatings() {
  const { state, update } = useStore();
  const addRating = useAddRating();
  const traits = state.goals.map((g) => g.trait).filter((t) => RATED_TRAITS.includes(t));
  const requests = state.ratingRequests ?? [];
  const askedBefore = [...new Set(requests.map((r) => r.label.trim()).filter(Boolean))];
  const [name, setName] = useState('');
  const [who, setWho] = useState('');
  const [link, setLink] = useState('');
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const ratings = [...(state.observerRatings ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!traits.length) return null;

  async function ask(label = who) {
    const id = newId();
    const url = `${appUrl()}#/rate?d=${encodeRequest({ id, name: name.trim(), traits })}`;
    setLink(url);
    // Remember who this link was for, so a later reply from the same person can be compared with this one.
    const request: SentRatingRequest = { id, label: label.trim(), date: today() };
    update((s) => ({ ...s, ratingRequests: [...(s.ratingRequests ?? []), request] }));
    const text = `I'm working on ${traits.map((t) => TRAITS[t].goalName.toLowerCase()).join(' and ')}. Would you rate how you see me? It takes about 3 minutes: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rate me in Trait Trainer', text });
        return;
      }
    } catch {
      // Cancelled: the link stays on screen to copy.
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied a message with the link. Paste it to someone who sees you often.');
    } catch {
      setMessage('Copy the link below and send it.');
    }
  }

  function add() {
    try {
      const r = addRating(paste);
      setPaste('');
      setMessage(`Added ${r.relation.toLowerCase()}’s rating from ${formatDate(r.date)}.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const latestSelf = state.assessments[state.assessments.length - 1];
  const firstSelf = state.assessments[0];
  const anyRepeat = traits.some((t) => ratersFor(t, ratings, requests).some((r) => r.count > 1));

  return (
    <section className="card stack" id="friend-ratings">
      <h2>How others see you</h2>
      <p className="muted">Optional. Ask someone who sees you often, now and again in a month or two.</p>
      <details>
        <summary>Why?</summary>
        <p>
          Others can notice things your own ratings miss. In a coaching-app trial, friends and family saw rises in the
          traits people wanted more of, though less than people saw in themselves, and didn't reliably see decreases.
          Their view isn't fully objective either. Asking the same people twice shows change; one rating is a snapshot.
        </p>
        <RefList ids={['stieger2021']} />
      </details>

      {ratings.length > 0 && (
        <div className="stack">
          {traits.map((t) => (
            <RatingSummary
              key={t}
              trait={t}
              ratings={ratings}
              requests={requests}
              self={latestSelf?.scores[t]}
              firstSelf={firstSelf?.scores[t]}
            />
          ))}
          {!anyRepeat && (
            <p className="muted" style={{ margin: 0 }}>
              No one has rated you twice yet. Ask the same people again in a month or two.
            </p>
          )}
          <details>
            <summary>How to read this</summary>
            <ul>
              <li>
                Compare each person with their own earlier rating, not with yours. People see themselves a little
                differently from how others see them.
              </li>
              <li>
                "Since their first" compares two ratings from the same person on a 1–5 scale. Under about 0.3 can be
                noise.
              </li>
              <li>"Change they recall" is their impression of the past two months, not a measurement.</li>
            </ul>
          </details>
        </div>
      )}

      <div className="stack">
        <label className="field">
          <span>Your first name (optional, shown to them)</span>
          <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Who are you asking? (only you see this)</span>
          <input type="text" value={who} maxLength={40} onChange={(e) => setWho(e.target.value)} placeholder="E.g. Sam" />
        </label>
        <div className="row">
          <button className="primary" onClick={() => void ask()}>
            Ask someone to rate you
          </button>
        </div>
        {askedBefore.length > 0 && (
          <div className="chips" role="group" aria-label="Ask again" style={{ margin: 0, alignItems: 'center' }}>
            <span className="muted">Ask again:</span>
            {askedBefore.map((l) => (
              <button key={l} className="chip" onClick={() => void ask(l)}>
                {l}
              </button>
            ))}
          </div>
        )}
        {link && (
          <label className="field">
            <span>Rating link</span>
            <textarea readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
        <label className="field">
          <span>Got a reply? Paste their link here</span>
          <textarea rows={2} value={paste} onChange={(e) => setPaste(e.target.value)} />
        </label>
        <div className="row">
          <button disabled={!paste.trim()} onClick={add}>
            Add their rating
          </button>
        </div>
        {message && (
          <p className="muted" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function RatingSummary({
  trait,
  ratings,
  requests,
  self,
  firstSelf,
}: {
  trait: TraitId;
  ratings: ObserverRating[];
  requests: SentRatingRequest[];
  self?: number;
  firstSelf?: number;
}) {
  const rows = ratersFor(trait, ratings, requests);
  if (!rows.length) return null;
  return (
    <div className="card soft" style={{ marginBottom: 0 }}>
      <h3>{TRAITS[trait].goalName}</h3>
      <div className="table-scroll">
        <table className="ratings rater-table">
          <thead>
            <tr>
              <th scope="col">Who</th>
              <th scope="col">Their score</th>
              <th scope="col">Since their first</th>
              <th scope="col">Change they recall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.who}</td>
                <td data-label="Score">
                  {r.latest.score.toFixed(1)} <span className="muted">({formatDate(r.latest.date)})</span>
                </td>
                <td data-label={r.count > 1 ? 'Since first' : ''}>{r.count > 1 ? signed(r.latest.score - r.first.score) : 'first rating'}</td>
                <td data-label="Recalls">{r.impression != null ? CHANGE_LABELS[r.impression + 2] : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {self != null && (
        <p className="muted" style={{ margin: 0 }}>
          Your own latest score: {self.toFixed(1)}
          {firstSelf != null && self !== firstSelf ? ` (${signed(self - firstSelf)} since your first)` : ''}.
        </p>
      )}
    </div>
  );
}

function signed(d: number): string {
  return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
}
