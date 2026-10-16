import { useState } from 'react';
import type { EvidenceLevel, TraitId } from '../types';
import { offeredTraits } from '../types';
import { AGREEABLENESS_NOTE, TRAITS } from '../data/traits';
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
      <p className="muted">The techniques behind each challenge, and how strong the research is.</p>

      <div className="chips" role="group" aria-label="Show techniques for">
        {offeredTraits(state.goals.map((g) => g.trait)).map((t) => (
          <button key={t} aria-pressed={trait === t} className="chip" onClick={() => setTrait(t)}>
            <span className="trait-dot" style={{ background: traitColor(t) }} />
            {TRAITS[t].goalShort}
          </button>
        ))}
      </div>

      <div className="card disclosure-list">
        <details>
          <summary>Why {TRAITS[trait].goalShort.toLowerCase()} matters</summary>
          <p style={{ margin: '0 0 6px' }}>{TRAITS[trait].whyItMatters}</p>
          {trait === 'A' && <p style={{ margin: '6px 0' }}>{AGREEABLENESS_NOTE}</p>}
          <RefList ids={TRAITS[trait].refs} />
        </details>

        <details>
          <summary>What the labels mean</summary>
          <ul>
            <li>
              <EvidencePill level="strong" />: several randomized trials or meta-analyses.
            </li>
            <li>
              <EvidencePill level="moderate" />: some trials, with smaller or mixed effects.
            </li>
            <li>
              <EvidencePill level="emerging" />: promising early studies. Treat it as an experiment.
            </li>
          </ul>
          <p>
            Labels rate the general technique. No study has tested these exact exercises or Trait Trainer itself. Most
            techniques were tested on nearby outcomes (anxiety, goals, well-being), not trait scores, and some only as
            one part of a larger program. Each technique's notes say which.
          </p>
          <p style={{ margin: 0 }}>
            The challenges, levels, the 7/10 confidence check and the 12-week schedule are our own design, based on the
            research but not tested themselves.
          </p>
        </details>
      </div>

      {techniques.map((t) => {
        const challenges = CHALLENGES.filter((c) => c.technique === t.id && c.trait === trait);
        return (
          <div className="card" key={t.id}>
            <h3 style={{ margin: 0 }}>{t.name}</h3>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <EvidencePill level={t.evidence} technique />
            </div>
            <p style={{ marginTop: 8 }}>{t.summary}</p>
            <details>
              <summary>Why it may work</summary>
              <p style={{ marginTop: 0 }}>{t.how}</p>
              <p>
                <strong>Evidence:</strong> {t.evidenceNote}
              </p>
              <RefList ids={t.refs} />
            </details>
            {challenges.length > 0 && (
              <details>
                <summary>
                  {challenges.length} challenge{challenges.length > 1 ? 's' : ''}
                </summary>
                <ul style={{ paddingLeft: '1.1em' }}>
                  {challenges.map((c) => (
                    <li key={c.id} style={{ marginTop: 6 }}>
                      <strong>{c.title}</strong> <span className="pill">{LEVEL_LABEL[c.level]}</span>
                      <div>{c.instructions}</div>
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
