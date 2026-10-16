import { useMemo, useState } from 'react';
import { CHANGE_LABELS, CHANGE_PHRASE, OBSERVER_ITEMS, RELATIONS } from '../data/observer';
import { TRAITS } from '../data/traits';
import { LIKERT_LABELS } from '../lib/scoring';
import { appUrl, decodeRequest, encodeReply, type RatingReply } from '../lib/observer';
import { today } from '../lib/dates';
import type { TraitId } from '../types';
import { Likert } from '../components/common';

/**
 * What a friend sees when they open a rating link. Nothing is saved in their browser:
 * their answers are packed into a reply link for them to send back.
 */
export function Rate({ query }: { query: string }) {
  const request = useMemo(() => {
    try {
      return decodeRequest(new URLSearchParams(query).get('d') ?? '');
    } catch (e) {
      return e as Error;
    }
  }, [query]);
  const [relation, setRelation] = useState('');
  const [answers, setAnswers] = useState<Partial<Record<TraitId, (number | undefined)[]>>>({});
  const [change, setChange] = useState<Partial<Record<TraitId, number>>>({});
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);

  if (request instanceof Error) {
    return (
      <div>
        <h1>Rating link</h1>
        <p>{request.message}</p>
      </div>
    );
  }

  const who = request.name || 'this person';
  const Who = request.name || 'This person';
  const complete =
    relation &&
    request.traits.every((t) => OBSERVER_ITEMS[t]!.every((_, i) => answers[t]?.[i]) && change[t] != null);

  function finish() {
    const r: RatingReply = {
      requestId: request instanceof Error ? '' : request.id,
      relation,
      date: today(),
      answers: Object.fromEntries(Object.entries(answers).map(([t, a]) => [t, a!.map(Number)])),
      change: Object.fromEntries(Object.entries(change).map(([t, c]) => [t, c! - 3])),
    };
    setReply(`${appUrl()}#/rated?d=${encodeReply(r)}`);
  }

  async function send() {
    const text = `My rating for you in Trait Trainer: ${reply}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Trait Trainer rating', text });
        return;
      }
    } catch {
      // Share cancelled or unavailable: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (reply) {
    return (
      <div>
        <h1>Thank you</h1>
        <p>Send this link back to {who}. Your answers are inside it. Nothing was saved or sent anywhere else.</p>
        <div className="page-actions">
          <button className="primary" onClick={() => void send()}>
            Send it back
          </button>
        </div>
        {copied && <p role="status">Copied. Paste it into a message to {who}.</p>}
        <label className="field">
          <span>Or copy the link yourself</span>
          <textarea readOnly rows={4} value={reply} onFocus={(e) => e.currentTarget.select()} />
        </label>
      </div>
    );
  }

  return (
    <div>
      <h1>How do you see {who}?</h1>
      <p className="muted">
        {Who} wants to {request.traits.map((t) => TRAITS[t].goalName.toLowerCase()).join(' and ')}. Rate how they've
        actually acted over the past month, not how they could be. It takes about 3 minutes, and your answers stay on
        this phone until you send them.
      </p>

      <div className="card">
        <label className="field">
          <span>How do you know {who}?</span>
          <select value={relation} onChange={(e) => setRelation(e.target.value)}>
            <option value="">Choose…</option>
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      {request.traits.map((t) => (
        <section key={t} className="stack" style={{ marginTop: 18 }}>
          <h2>{TRAITS[t].goalName}</h2>
          {OBSERVER_ITEMS[t]!.map(([text], i) => (
            <div className="card" key={text}>
              <strong>{text}</strong>
              <Likert
                labels={LIKERT_LABELS}
                label={text}
                value={answers[t]?.[i]}
                onChange={(v) =>
                  setAnswers((a) => {
                    const row = [...(a[t] ?? [])];
                    row[i] = v;
                    return { ...a, [t]: row };
                  })
                }
              />
            </div>
          ))}
          <div className="card soft">
            <strong>
              Compared with about two months ago, is {who} now more or less {CHANGE_PHRASE[t]}?
            </strong>
            <Likert
              labels={CHANGE_LABELS}
              label={`Change in ${TRAITS[t].goalName.toLowerCase()}`}
              value={change[t]}
              onChange={(v) => setChange((c) => ({ ...c, [t]: v }))}
            />
          </div>
        </section>
      ))}

      <div className="page-actions">
        <button className="primary" disabled={!complete} onClick={finish}>
          Finish
        </button>
        {!complete && <small>Answer every question to finish.</small>}
      </div>
      <p className="refs" style={{ marginTop: 16 }}>Items adapted from the International Personality Item Pool (Goldberg, 1992).</p>
    </div>
  );
}
