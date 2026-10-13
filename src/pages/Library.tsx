import { useState } from 'react';
import type { EvidenceLevel, TraitId } from '../types';
import { TRAIT_IDS } from '../types';
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
      <p className="muted">
        Every challenge in Trait Trainer comes from a technique with published research behind it. Each technique is
        labelled with how strong its evidence is, and for what outcome, so you know what you're getting.
      </p>

      <div className="row" style={{ gap: 6, margin: '12px 0 18px' }} role="tablist">
        {TRAIT_IDS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={trait === t}
            className={trait === t ? 'primary' : ''}
            onClick={() => setTrait(t)}
          >
            <span className="trait-dot" style={{ background: traitColor(t) }} />
            {TRAITS[t].goalShort}
          </button>
        ))}
      </div>

      <div className="card soft">
        <strong>{TRAITS[trait].goalName}</strong>
        <p style={{ margin: '6px 0' }}>{TRAITS[trait].whyItMatters}</p>
        <RefList ids={TRAITS[trait].refs} />
      </div>

      <details className="card" style={{ fontSize: '0.92rem' }}>
        <summary>What the evidence labels mean</summary>
        <ul>
          <li>
            <EvidencePill level="strong" />: supported by multiple randomized trials and/or meta-analyses.
          </li>
          <li>
            <EvidencePill level="moderate" />: supported by some randomized trials, but with smaller or mixed effects.
          </li>
          <li>
            <EvidencePill level="emerging" />: promising early studies; treat it as an experiment.
          </li>
        </ul>
        <p className="muted" style={{ margin: 0 }}>
          Most techniques were tested on outcomes close to a trait (anxiety, goal attainment, well-being, social
          connection) rather than on the trait score itself. The notes say which.
        </p>
      </details>

      {techniques.map((t) => {
        const challenges = CHALLENGES.filter((c) => c.technique === t.id && c.trait === trait);
        return (
          <div className="card" key={t.id}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{t.name}</h3>
              <EvidencePill level={t.evidence} />
            </div>
            <p style={{ marginTop: 8 }}>{t.summary}</p>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              <strong>Why it works:</strong> {t.how}
            </p>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              <strong>Evidence:</strong> {t.evidenceNote}
            </p>
            <RefList ids={t.refs} />
            {challenges.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary>
                  {challenges.length} challenge{challenges.length > 1 ? 's' : ''}
                </summary>
                <ul style={{ paddingLeft: '1.1em' }}>
                  {challenges.map((c) => (
                    <li key={c.id} style={{ marginTop: 6 }}>
                      <strong>{c.title}</strong> <span className="pill">{LEVEL_LABEL[c.level]}</span>
                      <div style={{ fontSize: '0.92rem' }}>{c.instructions}</div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
