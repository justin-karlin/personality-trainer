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
      <p className="muted">
        Every challenge in Trait Trainer applies a technique that has been studied. Each technique is labelled with how
        strong the research on it is, and for what outcome. The labels rate the general technique: no study has tested
        these exact exercises, or Trait Trainer itself.
      </p>

      <div className="chips" role="group" aria-label="Show techniques for">
        {offeredTraits(state.goals.map((g) => g.trait)).map((t) => (
          <button key={t} aria-pressed={trait === t} className="chip" onClick={() => setTrait(t)}>
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
        <p className="muted">
          Most techniques were tested on outcomes close to a trait (anxiety, goal attainment, well-being, social
          connection) rather than on the trait score itself. The notes say which.
        </p>
        <p className="muted">The evidence behind a technique can be of different kinds, and the notes say which:</p>
        <ul className="muted">
          <li>tests of the technique itself, often across many kinds of goals;</li>
          <li>tests of a whole program in which it was one ingredient, so its own share of the effect is unknown;</li>
          <li>studies that only found it went along with change, which can't show it caused the change.</li>
        </ul>
        <p className="muted" style={{ margin: 0 }}>
          The exact challenges, and the app's suggestions (levels, the 7/10 confidence check, the 12-week schedule), are
          our own design choices. They follow the research but haven't been tested themselves.
        </p>
      </details>

      {techniques.map((t) => {
        const challenges = CHALLENGES.filter((c) => c.technique === t.id && c.trait === trait);
        return (
          <div className="card" key={t.id}>
            <h3 style={{ margin: 0 }}>{t.name}</h3>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <EvidencePill level={t.evidence} technique />
            </div>
            <p style={{ marginTop: 8 }}>{t.summary}</p>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              <strong>Why it may work:</strong> {t.how}
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
