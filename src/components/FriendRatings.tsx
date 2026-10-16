import { useState } from 'react';
import { useStore } from '../store';
import { TRAITS } from '../data/traits';
import { CHANGE_LABELS, RATED_TRAITS } from '../data/observer';
import { appUrl, decodeReply, encodeRequest, ratersFor, toObserverRating } from '../lib/observer';
import { formatDate, today } from '../lib/dates';
import type { ObserverRating, SentRatingRequest, TraitId } from '../types';

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
      setMessage('Copied. Paste it in a message.');
    } catch {
      setMessage('Copy the link below.');
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

  return (
    <section className="card stack" id="friend-ratings">
      <h2>How others see you</h2>

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
          <details>
            <summary>How to read this</summary>
            <ul>
              <li>Compare each person with their own last rating.</li>
              <li>Changes under 0.3 can be noise.</li>
              <li>"Noticed" is their impression of change.</li>
            </ul>
          </details>
        </div>
      )}

      <div className="stack">
        <label className="field">
          <span>Your name (they see it)</span>
          <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Who you're asking (private)</span>
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
          <span>Paste a reply link</span>
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
    <div className="rating-summary">
      <h3>{TRAITS[trait].goalName}</h3>
      <table className="ratings">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">Score</th>
            <th scope="col">Noticed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.who}</td>
              <td>
                {r.latest.score.toFixed(1)}
                {r.count > 1 && <span className="muted"> ({signed(r.latest.score - r.first.score)})</span>}
              </td>
              <td>{r.impression != null ? CHANGE_LABELS[r.impression + 2] : '–'}</td>
            </tr>
          ))}
          {self != null && (
            <tr className="self">
              <td>You</td>
              <td>
                {self.toFixed(1)}
                {firstSelf != null && self !== firstSelf && <span className="muted"> ({signed(self - firstSelf)})</span>}
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function signed(d: number): string {
  return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
}
