import { useStore } from '../store';
import { navigate } from '../router';
import { TRAIT_IDS } from '../types';
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
      <h1>{isRetake ? 'Your updated profile' : 'Your Big Five profile'}</h1>
      <p className="muted">
        Scores run from 1 to 5. Percentiles are rough estimates against a large online sample, so treat them as a
        guide, not a verdict. No trait level is "good" or "bad" in every situation.
        {isRetake && ` The thin line marks your first score (${formatDate(first.date)}).`}
      </p>

      {suggestsSupport(latest.wellbeing) && <SupportCard wellbeing={latest.wellbeing!} />}

      <div className="card">
        <TraitBars scores={latest.scores} baseline={isRetake ? first.scores : undefined} />
      </div>

      {isRetake && (
        <div className="card soft">
          <small>
            <strong>Reading a change.</strong> Scores move for many reasons: a good or bad week, expecting to change, or
            simply taking the test again. Compare the traits you're working on with the ones you're not, and ask
            someone who sees you often whether they notice a difference.
          </small>
          <RefList ids={['kramer2025', 'lorenzoluaces2023', 'stieger2021']} />
        </div>
      )}

      <div className="grid-2">
        {TRAIT_IDS.map((t) => {
          const info = TRAITS[t];
          // Describe the level from the percentile shown in the bars, so the words match the numbers.
          const p = percentile(PERCENTILES[t], latest.scores[t]);
          const level = p >= 70 ? 'high' : p <= 30 ? 'low' : 'mid';
          return (
            <div className="card" key={t}>
              <h3 className="row" style={{ gap: 8 }}>
                <span className="trait-dot" style={{ background: traitColor(t) }} />
                {info.name}
              </h3>
              <p>{info.short}</p>
              <p className="muted" style={{ fontSize: '0.92rem' }}>
                {level === 'high' ? info.high : level === 'low' ? info.low : `You land in the middle range: ${info.mid}`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="row">
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

function SupportCard({ wellbeing }: { wellbeing: { anxiety: number; depression: number } }) {
  const areas = [wellbeing.anxiety >= 3 && 'anxiety or worry', wellbeing.depression >= 3 && 'low mood']
    .filter(Boolean)
    .join(' and ');
  return (
    <div className="card tip care">
      <h3>A note on how you've been feeling</h3>
      <p>
        Your answers suggest you've been dealing with a fair amount of {areas} over the last two weeks. That's common
        and very treatable. For this level, it's worth talking to a doctor or mental-health professional: evidence-based
        therapy such as CBT works well, and works better than self-guided apps for moderate or severe symptoms.
      </p>
      <p style={{ marginBottom: 0 }}>
        You're welcome to use Trait Trainer alongside that. If you ever feel unsafe, call or text <strong>988</strong>{' '}
        (US) or find a local line at{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        .
      </p>
    </div>
  );
}
