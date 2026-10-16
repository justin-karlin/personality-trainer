import { useState } from 'react';
import type { Challenge, TraitId } from '../types';
import { COACH_URL } from '../lib/ai';
import { SupportCard, SupportLine } from './common';

// The AI coach turns a real upcoming situation into if-then plan suggestions. It runs on
// a small server (worker/) that holds the Claude API key, and only appears when the
// build sets VITE_COACH_URL. It is sent the goal, the chosen challenge, the current plan
// and what the user types here; nothing else. Its suggestions are always for the chosen
// challenge, and only replace the plan's wording when the user picks one.
const COACH_TRAITS: TraitId[] = ['C', 'A'];

export function coachAvailable(trait: TraitId): boolean {
  return !!COACH_URL && COACH_TRAITS.includes(trait);
}

interface Plan {
  ifThen: string;
  why: string;
}

export function PlanCoach({
  challenge,
  plan,
  onUse,
}: {
  challenge: Challenge;
  plan: string;
  onUse: (ifThen: string) => void;
}) {
  const trait = challenge.trait;
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
        body: JSON.stringify({
          goal: trait,
          situation: situation.trim(),
          challenge: { title: challenge.title, instructions: challenge.instructions },
          plan: plan.trim() || undefined,
        }),
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
          <span>What's coming up?</span>
          <textarea
            rows={2}
            maxLength={400}
            value={situation}
            placeholder={trait === 'C' ? 'E.g. “Tomorrow’s 9am meeting with Alex about the budget”' : 'E.g. “Sunday dinner with my sister, who always criticises my job”'}
            onChange={(e) => setSituation(e.target.value)}
          />
          <small>
            Sent with this challenge and your plan to Anthropic's Claude. We don't keep it; Anthropic deletes it within
            30 days (longer if flagged) and doesn't train on it. Leave out names.
          </small>
        </label>
        <div className="row">
          <button disabled={situation.trim().length < 3 || status === 'loading'} onClick={() => void ask()}>
            {status === 'loading' ? 'Thinking…' : 'Suggest plans'}
          </button>
        </div>
        {status === 'error' && (
          <>
            <p role="alert" style={{ color: 'var(--warn)', margin: 0 }}>
              {error}
            </p>
            <SupportLine />
          </>
        )}
        {needsSupport && <SupportCard lead="It sounds like things may be hard right now." />}
        {plans.length > 0 && plan.trim() && (
          <p className="coach-current">
            <small>
              Your plan now: <em>{plan.trim()}</em>
            </small>
          </p>
        )}
        {plans.length > 0 && (
          <ul className="coach-plans" aria-live="polite">
            {plans.map((p) => (
              <li key={p.ifThen}>
                <p>{p.ifThen}</p>
                <small>{p.why}</small>
                <button className="ghost" disabled={p.ifThen === plan.trim()} onClick={() => onUse(p.ifThen)}>
                  {p.ifThen === plan.trim() ? 'This is your plan' : plan.trim() ? 'Replace my plan with this' : 'Use this plan'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
