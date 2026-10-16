import { useStore } from '../store';
import { navigate } from '../router';
import { GOAL_TRAITS, type TraitId } from '../types';
import { TRAITS } from '../data/traits';
import { TraitBars } from '../components/TraitBars';
import { formatDate } from '../lib/dates';
import { traitColor } from '../components/common';
import { percentile, suggestsSupport } from '../lib/scoring';
import { PERCENTILES } from '../data/norms';
import { RefList } from '../components/common';

export function Results() {
  const { state } = useStore();
  const latest = state.assessments[state.assessments.length - 1];
  const first = state.assessments[0];
  if (!latest) return null;
  const isRetake = state.assessments.length > 1;

  return (
    <div>
      <h1>{isRetake ? 'Your updated profile' : 'Your personality profile'}</h1>
      <p>{isRetake ? `The thin line is your first score (${formatDate(first.date)}).` : 'No score is good or bad.'}</p>

      {suggestsSupport(latest.wellbeing) && <SupportCard wellbeing={latest.wellbeing!} />}

      <div className="card">
        <TraitBars scores={latest.scores} baseline={isRetake ? first.scores : undefined} />
        <details>
          <summary>How to read this</summary>
          <p>Percentiles are rough. Scores also move with mood and retesting.</p>
          {isRetake && <RefList ids={['kramer2025', 'lorenzoluaces2023', 'stieger2021']} />}
        </details>
      </div>

      <div className="grid-2">
        {GOAL_TRAITS.map((t) => (
          <div className="card" key={t}>
            <h3 className="row" style={{ gap: 8 }}>
              <span className="trait-dot" style={{ background: traitColor(t) }} />
              {TRAITS[t].name}
            </h3>
            <p>{levelText(t, latest.scores[t])}</p>
          </div>
        ))}
      </div>

      <div className="page-actions">
        {state.goals.length ? (
          <>
            <button className="primary" onClick={() => navigate('today')}>
              Back to today
            </button>
            {isRetake && <button onClick={() => navigate('goals')}>Edit goals</button>}
          </>
        ) : (
          <button className="primary" onClick={() => navigate('goals')}>
            Pick a goal →
          </button>
        )}
      </div>
    </div>
  );
}

/** Describe the level from the percentile shown in the bars, so the words match the numbers. */
function levelText(t: TraitId, score: number): string {
  const p = percentile(PERCENTILES[t], score);
  if (p >= 70) return TRAITS[t].high;
  if (p <= 30) return TRAITS[t].low;
  return TRAITS[t].mid;
}

function SupportCard({ wellbeing }: { wellbeing: { anxiety: number; depression: number } }) {
  const areas = [wellbeing.anxiety >= 3 && 'worry', wellbeing.depression >= 3 && 'low mood'].filter(Boolean).join(' and ');
  return (
    <div className="card tip care">
      <h3>How you've been feeling</h3>
      <p>A lot of {areas} lately? A doctor or therapist can help.</p>
      <p style={{ marginBottom: 0 }}>
        Feel unsafe? Call or text <strong>988</strong> (US) or visit{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        .
      </p>
    </div>
  );
}
