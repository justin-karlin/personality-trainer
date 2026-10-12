import { STAGES, type StageId } from '../lib/path';
import { EvidencePill, RefList } from './common';

/** The stepwise path with the current stage expanded. */
export function PathCard({ stage }: { stage: StageId }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  const current = STAGES[idx];
  return (
    <section className="card" aria-label="Your path">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Your path</h2>
        <small>
          Step {idx + 1} of {STAGES.length}
        </small>
      </div>
      <ol className="path-steps" style={{ margin: '10px 0' }}>
        {STAGES.map((s, i) => (
          <li key={s.id} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
            {s.title}
          </li>
        ))}
      </ol>
      <p style={{ marginBottom: 6 }}>
        <strong>Now: </strong>
        {current.focus}
      </p>
      <details>
        <summary style={{ fontSize: '0.88rem' }}>Why this step</summary>
        <p style={{ fontSize: '0.92rem', margin: '6px 0' }}>{current.why}</p>
        <div className="row" style={{ gap: 6 }}>
          <EvidencePill level={current.evidence} />
          <RefList ids={current.refs} />
        </div>
        <small className="muted">
          Steps 1–3 target things that went with more change in studies (small links, mostly in self-ratings). The
          main trials also had people work on one trait. The order and the consolidation step are this app's own
          design and haven't been tested.
        </small>
      </details>
    </section>
  );
}
