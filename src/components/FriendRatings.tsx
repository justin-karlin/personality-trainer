import { useState } from 'react';
import { useStore } from '../store';
import { TRAITS } from '../data/traits';
import { CHANGE_LABELS, RATED_TRAITS } from '../data/observer';
import { appUrl, decodeReply, encodeRequest, toObserverRating } from '../lib/observer';
import { formatDate } from '../lib/dates';
import type { ObserverRating, TraitId } from '../types';
import { RefList } from './common';

const newId = () => Math.random().toString(36).slice(2, 10);
const SEEN_AS: Partial<Record<TraitId, string>> = { C: 'reliable', A: 'easy to get along with' };

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
  const { state } = useStore();
  const addRating = useAddRating();
  const traits = state.goals.map((g) => g.trait).filter((t) => RATED_TRAITS.includes(t));
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const ratings = [...(state.observerRatings ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!traits.length) return null;

  async function ask() {
    const url = `${appUrl()}#/rate?d=${encodeRequest({ id: newId(), name: name.trim(), traits })}`;
    setLink(url);
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

  return (
    <section className="card stack" id="friend-ratings">
      <h2>How others see you</h2>
      <p className="muted">
        People who see you often can confirm change that your own ratings can't. In a coaching-app trial, friends and
        family rated rises in the traits people wanted more of, though less strongly than people rated themselves. Ask
        the same people again every month or so.
      </p>
      <RefList ids={['stieger2021']} />

      {ratings.length > 0 && (
        <div className="stack">
          {traits.map((t) => (
            <RatingSummary key={t} trait={t} ratings={ratings} self={latestSelf?.scores[t]} firstSelf={firstSelf?.scores[t]} />
          ))}
        </div>
      )}

      <div className="stack">
        <label className="field">
          <span>Your first name (optional, shown to them)</span>
          <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        <div className="row">
          <button className="primary" onClick={() => void ask()}>
            Ask someone to rate you
          </button>
        </div>
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
  self,
  firstSelf,
}: {
  trait: TraitId;
  ratings: ObserverRating[];
  self?: number;
  firstSelf?: number;
}) {
  const rows = ratings.filter((r) => r.scores[trait] != null);
  if (!rows.length) return null;
  const changes = rows.map((r) => r.change[trait]).filter((c): c is number => c != null);
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
  return (
    <div className="card soft" style={{ margin: 0 }}>
      <h3>{TRAITS[trait].goalName}</h3>
      <table className="ratings">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">Date</th>
            <th scope="col">Score</th>
            <th scope="col">Change they see</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.relation}</td>
              <td>{formatDate(r.date)}</td>
              <td>{r.scores[trait]!.toFixed(1)}</td>
              <td>{r.change[trait] != null ? CHANGE_LABELS[r.change[trait]! + 2] : '–'}</td>
            </tr>
          ))}
          {self != null && (
            <tr className="self">
              <td>You</td>
              <td>latest</td>
              <td>{self.toFixed(1)}</td>
              <td>{firstSelf != null ? `${self - firstSelf >= 0 ? '+' : ''}${(self - firstSelf).toFixed(1)} since your first` : '–'}</td>
            </tr>
          )}
        </tbody>
      </table>
      {avgChange != null && (
        <small>
          On average, they see you as{' '}
          {avgChange > 0.25 ? `more ${SEEN_AS[trait]} than` : avgChange < -0.25 ? `less ${SEEN_AS[trait]} than` : `about as ${SEEN_AS[trait]} as`}{' '}
          a couple of months ago. Their scores use the same 1–5 scale as yours, but people usually see themselves a
          little differently from how others see them.
        </small>
      )}
    </div>
  );
}
