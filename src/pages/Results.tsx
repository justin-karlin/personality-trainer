import { useStore } from '../store';
import { navigate } from '../router';
import { GOAL_TRAITS, TRAIT_IDS, type TraitId } from '../types';
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
      <p>
        Scores run from 1 to 5. No level is good or bad in every situation.
        {isRetake && ` The thin line marks your first score (${formatDate(first.date)}).`}
      </p>

      {suggestsSupport(latest.wellbeing) && <SupportCard wellbeing={latest.wellbeing!} />}

      <div className="card">
        <TraitBars scores={latest.scores} baseline={isRetake ? first.scores : undefined} />
        <details>
          <summary>How to read this</summary>
          <p>Percentiles are rough estimates against a large online sample. Treat them as a guide, not a verdict.</p>
          {isRetake && (
            <>
              <p>
                Scores move for many reasons: a good or bad week, expecting to change, or just taking the test again.
                Compare the traits you're working on with the ones you're not, and ask someone who sees you often.
              </p>
              <RefList ids={['kramer2025', 'lorenzoluaces2023', 'stieger2021']} />
            </>
          )}
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

      <details className="card">
        <summary>Your other traits</summary>
        {TRAIT_IDS.filter((t) => !GOAL_TRAITS.includes(t)).map((t) => (
          <p key={t}>
            <strong>{TRAITS[t].name}.</strong> {levelText(t, latest.scores[t])}
          </p>
        ))}
      </details>

      <div className="page-actions">
        {state.goals.length ? (
          <>
            <button className="primary" onClick={() => navigate('today')}>
              Back to today
            </button>
            {isRetake && <button onClick={() => navigate('goals')}>Revisit your goals</button>}
          </>
        ) : (
          <button className="primary" onClick={() => navigate('goals')}>
            Choose what to work on →
          </button>
        )}
      </div>
    </div>
  );
}

/** Describe the level from the percentile shown in the bars, so the words match the numbers. */
function levelText(t: TraitId, score: number): string {
  const info = TRAITS[t];
  const p = percentile(PERCENTILES[t], score);
  if (p >= 70) return info.high;
  if (p <= 30) return info.low;
  return `You land in the middle range: ${info.mid}`;
}

function SupportCard({ wellbeing }: { wellbeing: { anxiety: number; depression: number } }) {
  const areas = [wellbeing.anxiety >= 3 && 'anxiety or worry', wellbeing.depression >= 3 && 'low mood']
    .filter(Boolean)
    .join(' and ');
  return (
    <div className="card tip care">
      <h3>A note on how you've been feeling</h3>
      <p>
        Your answers suggest a fair amount of {areas} in the last two weeks. That's common and very treatable. It's
        worth talking to a doctor or therapist: therapy such as CBT works well, better than apps for moderate or severe
        symptoms.
      </p>
      <p style={{ marginBottom: 0 }}>
        If you ever feel unsafe, call or text <strong>988</strong> (US) or find a local line at{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        .
      </p>
    </div>
  );
}
