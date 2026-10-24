import { useState } from 'react';
import { COACH_URL, requestReview, type ReviewChange, type WeekReviewReply } from '../lib/ai';
import { challengeById } from '../data/challenges';
import { highlightIfThen } from '../pages/Today';
import { SupportCard, SupportLine } from './common';
import type { Commitment } from '../types';

/**
 * An optional AI review of the week. It proposes at most two changes; nothing changes
 * unless the person applies one, and applied changes only pre-fill next week's plan.
 */
export function WeekReview({
  commitments,
  build,
  applied,
  onApply,
  onClear,
}: {
  commitments: Commitment[];
  /** Builds the request from the week and the reflection as currently typed. */
  build: (depth: 'standard' | 'deeper') => Parameters<typeof requestReview>[0];
  applied: Record<string, ReviewChange | undefined>;
  onApply: (change: ReviewChange | undefined, planId: string) => void;
  /** A new review replaces the old one, so suggestions applied from the old one are undone. */
  onClear: () => void;
}) {
  const [reply, setReply] = useState<WeekReviewReply | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [deeper, setDeeper] = useState(false);
  if (!COACH_URL) return null;

  async function ask(depth: 'standard' | 'deeper') {
    setStatus('loading');
    setError('');
    try {
      const next = await requestReview(build(depth));
      onClear();
      setReply(next);
      if (depth === 'deeper') setDeeper(true);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(navigator.onLine ? (e as Error).message : 'You’re offline. Try again later.');
    }
  }

  return (
    <section className="card stack" aria-labelledby="review-title">
      <h2 id="review-title" style={{ margin: 0 }}>
        Review my week (optional)
      </h2>
      <small className="fine">
        An AI reviewer (Claude) reads this week's plans, what you logged and your reflection, and suggests at most two
        changes. Your week is sent to the Trait5 server and to Anthropic. Trait5 doesn't keep it;
        Anthropic deletes it within 30 days (longer only if its safety systems flag it) and doesn't train on it.
        Nothing changes unless you apply a suggestion, and you can still edit it when you plan. Its suggestions are
        untested ideas, not advice.
      </small>
      {!reply && (
        <div className="row">
          <button disabled={status === 'loading'} onClick={() => void ask('standard')}>
            {status === 'loading' ? 'Reviewing…' : 'Review my week'}
          </button>
        </div>
      )}
      {status === 'error' && (
        <>
          <p role="alert" style={{ color: 'var(--warn)', margin: 0 }}>
            {error}
          </p>
          <SupportLine />
        </>
      )}
      {reply && (
        <div className="stack" aria-live="polite">
          <p style={{ margin: 0 }}>{reply.summary}</p>
          {reply.needsSupport && (
            <SupportCard lead="It sounds like things may be hard right now. You don't have to keep up with any plan." />
          )}
          {reply.changes.length === 0 && <small className="fine">No changes suggested.</small>}
          {reply.changes.map((change) => {
            const c = commitments.find((x) => x.challengeId === change.planId);
            const title = challengeById(change.planId)?.title ?? change.planId;
            const on = applied[change.planId] === change;
            return (
              <div key={change.planId} className="card soft review-change" style={{ margin: 0 }}>
                <strong>{title}</strong>
                {change.ifThen && (
                  <>
                    <small className="fine">Now: {c?.ifThen}</small>
                    <p className="ifthen">{highlightIfThen(change.ifThen)}</p>
                  </>
                )}
                {change.target != null && (
                  <p style={{ margin: '4px 0' }}>
                    {c?.target} → <strong>{change.target}</strong> days next week
                  </p>
                )}
                {change.kind === 'drop' && <p style={{ margin: '4px 0' }}>Drop it for now.</p>}
                <small className="fine">{change.why}</small>
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    className={on ? 'primary' : ''}
                    aria-pressed={on}
                    onClick={() => onApply(on ? undefined : change, change.planId)}
                  >
                    {on ? 'Applied to next week' : 'Apply to next week'}
                  </button>
                </div>
              </div>
            );
          })}
          {!deeper && (
            <button type="button" className="link-btn" disabled={status === 'loading'} onClick={() => void ask('deeper')}>
              {status === 'loading' ? 'Reviewing…' : 'Ask for a more thorough review'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
