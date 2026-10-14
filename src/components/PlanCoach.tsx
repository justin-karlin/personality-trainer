import { useState } from 'react';
import type { TraitId } from '../types';

// The AI coach turns a real upcoming situation into if-then plan suggestions. It runs on
// a small server (worker/) that holds the Claude API key, and only appears when the
// build sets VITE_COACH_URL. What the user types here is sent there; nothing else is.
const COACH_URL: string | undefined = import.meta.env.VITE_COACH_URL;
const COACH_TRAITS: TraitId[] = ['C', 'A'];

export function coachAvailable(trait: TraitId): boolean {
  return !!COACH_URL && COACH_TRAITS.includes(trait);
}

interface Plan {
  ifThen: string;
  why: string;
}

export function PlanCoach({ trait, onUse }: { trait: TraitId; onUse: (ifThen: string) => void }) {
  const [situation, setSituation] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [needsSupport, setNeedsSupport] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  if (!coachAvailable(trait)) return null;

  async function ask() {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`${COACH_URL}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: trait, situation: situation.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'The coach couldn’t answer just now.');
      setPlans(body.plans);
      setNeedsSupport(body.needsSupport === true);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(navigator.onLine ? (e as Error).message : 'You’re offline. Write your plan yourself, or try again later.');
    }
  }

  return (
    <details className="plan-coach">
      <summary>Help me write this plan</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <label className="field">
          <span>What's coming up where you could practise this?</span>
          <textarea
            rows={2}
            maxLength={400}
            value={situation}
            placeholder={trait === 'C' ? 'E.g. “Tomorrow’s 9am meeting with Alex about the budget”' : 'E.g. “Sunday dinner with my sister, who always criticises my job”'}
            onChange={(e) => setSituation(e.target.value)}
          />
          <small>
            Sent to the Trait Trainer coach and to Anthropic's Claude to write suggestions. Not saved by Trait Trainer.
            Leave out names and details you'd rather not share.
          </small>
        </label>
        <div className="row">
          <button disabled={situation.trim().length < 3 || status === 'loading'} onClick={() => void ask()}>
            {status === 'loading' ? 'Thinking…' : 'Suggest plans'}
          </button>
        </div>
        {status === 'error' && (
          <p role="alert" style={{ color: 'var(--warn)', margin: 0 }}>
            {error}
          </p>
        )}
        {needsSupport && (
          <div className="card tip care" style={{ margin: 0 }}>
            <small>
              It sounds like things may be hard right now. If you're in crisis, call or text 988 (US) or find a helpline
              at <a href="https://findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a>.
            </small>
          </div>
        )}
        {plans.length > 0 && (
          <ul className="coach-plans" aria-live="polite">
            {plans.map((p) => (
              <li key={p.ifThen}>
                <p>{p.ifThen}</p>
                <small>{p.why}</small>
                <button className="ghost" onClick={() => onUse(p.ifThen)}>
                  Use this plan
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
