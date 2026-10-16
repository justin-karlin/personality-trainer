import { useState } from 'react';
import type { EvidenceLevel, TraitId } from '../types';
import { offeredTraits } from '../types';
import { TRAITS } from '../data/traits';
import { TECHNIQUES } from '../data/techniques';
import { CHALLENGES } from '../data/challenges';
import { useStore } from '../store';
import { EvidencePill, RefList, traitColor, LearnTabs } from '../components/common';

const ORDER: Record<EvidenceLevel, number> = { strong: 0, moderate: 1, emerging: 2 };
const LEVEL_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Stretch (optional)' } as const;

export function Library() {
  const { state } = useStore();
  const [trait, setTrait] = useState<TraitId>(state.goals[0]?.trait ?? 'C');
  const techniques = TECHNIQUES.filter((t) => t.traits.includes(trait)).sort(
    (a, b) => ORDER[a.evidence] - ORDER[b.evidence],
  );

  return (
    <div>
      <LearnTabs current="library" />
      <h1>Toolkit</h1>
      <p className="muted">The techniques behind your challenges.</p>

      <div className="chips two-up" role="group" aria-label="Show techniques for">
        {offeredTraits(state.goals.map((g) => g.trait)).map((t) => (
          <button key={t} aria-pressed={trait === t} className="chip" onClick={() => setTrait(t)}>
            <span className="trait-dot" style={{ background: traitColor(t) }} />
            {TRAITS[t].goalShort}
          </button>
        ))}
      </div>
      {trait === 'A' && <p className="muted">Be kind, and keep your boundaries.</p>}

      <div className="card disclosure-list">
        {techniques.map((t) => {
          const challenges = CHALLENGES.filter((c) => c.technique === t.id && c.trait === trait);
          return (
            <details key={t.id}>
              <summary className="tech-summary">
                <span>{t.name}</span>
                <EvidencePill level={t.evidence} />
              </summary>
              <p style={{ marginTop: 0 }}>{t.summary}</p>
              {challenges.length > 0 && (
                <ul style={{ paddingLeft: '1.1em' }}>
                  {challenges.map((c) => (
                    <li key={c.id} style={{ marginTop: 6 }}>
                      {c.title} <span className="pill">{LEVEL_LABEL[c.level]}</span>
                    </li>
                  ))}
                </ul>
              )}
              <RefList ids={t.refs} />
            </details>
          );
        })}
      </div>

      <details>
        <summary>What the labels mean</summary>
        <ul>
          <li>
            <EvidencePill level="strong" />: several trials or meta-analyses.
          </li>
          <li>
            <EvidencePill level="moderate" />: some trials, mixed effects.
          </li>
          <li>
            <EvidencePill level="emerging" />: early studies only.
          </li>
        </ul>
        <p style={{ margin: 0 }}>They rate the technique, not this app.</p>
      </details>
    </div>
  );
}
