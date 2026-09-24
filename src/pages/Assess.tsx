import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { AssessmentRecord } from '../types';
import { IPIP50, PHQ4_ITEMS, PHQ4_OPTIONS, PHQ4_STEM } from '../data/assessment';
import { LIKERT_LABELS, isComplete, scoreAssessment, scorePhq4 } from '../lib/scoring';
import { today } from '../lib/dates';
import { ProgressBar } from '../components/common';

const PER_PAGE = 10;
const IPIP_PAGES = Math.ceil(IPIP50.length / PER_PAGE);

export function Assess() {
  const { state, update } = useStore();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phq, setPhq] = useState<(number | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [page, setPage] = useState(0);
  const onWellbeingPage = page === IPIP_PAGES;
  const items = IPIP50.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const pageDone = items.every((i) => answers[i.id] != null);
  const answered = Object.keys(answers).length;
  const isRetake = state.assessments.length > 0;

  function goTo(p: number) {
    setPage(p);
    window.scrollTo(0, 0);
  }

  function finish(includeWellbeing: boolean) {
    if (!isComplete(IPIP50, answers)) return;
    const date = today();
    const record: AssessmentRecord = {
      id: `${date}-${Date.now()}`,
      date,
      answers,
      scores: scoreAssessment(IPIP50, answers),
    };
    if (includeWellbeing && phq.every((v) => v != null)) record.wellbeing = scorePhq4(phq as number[]);
    update((s) => ({ ...s, assessments: [...s.assessments, record] }));
    navigate('results');
  }

  if (onWellbeingPage) {
    return (
      <div>
        <h1>How have you been feeling?</h1>
        <p className="muted">
          Optional, 4 questions. This is a standard, brief check for anxiety and low mood (the PHQ-4). It helps the
          app point you toward extra support if you might benefit from it. It isn't a diagnosis, and it doesn't affect
          your personality scores.
        </p>
        <p>
          <strong>{PHQ4_STEM}</strong>
        </p>
        {PHQ4_ITEMS.map((text, i) => (
          <div className="card" key={text}>
            <strong>{text}</strong>
            <div className="likert" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} role="radiogroup" aria-label={text}>
              {PHQ4_OPTIONS.map((label, v) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={phq[i] === v}
                  className={phq[i] === v ? 'selected' : ''}
                  onClick={() => setPhq(phq.map((x, j) => (j === i ? v : x)))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="spread">
          <button onClick={() => goTo(IPIP_PAGES - 1)}>← Back</button>
          <div className="row">
            <button className="ghost" onClick={() => finish(false)}>
              Skip
            </button>
            <button className="primary" disabled={phq.some((v) => v == null)} onClick={() => finish(true)}>
              See my results
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{isRetake ? 'Retake the questionnaire' : 'Your personality profile'}</h1>
      <p className="muted">
        Describe yourself as you generally are now, not as you wish to be. Be honest; there are no right answers.
        {isRetake && ' Try not to look at or remember your previous answers.'}
      </p>
      <div className="spread" style={{ margin: '12px 0 6px' }}>
        <small>
          Page {page + 1} of {IPIP_PAGES}
        </small>
        <small>
          {answered}/{IPIP50.length} answered
        </small>
      </div>
      <ProgressBar value={answered / IPIP50.length} />

      <div style={{ marginTop: 16 }}>
        {items.map((item, i) => (
          <div className="card" key={item.id}>
            <div>
              <span className="muted">{page * PER_PAGE + i + 1}.</span> <strong>{firstPerson(item.text)}</strong>
            </div>
            <div className="likert" role="radiogroup" aria-label={item.text}>
              {LIKERT_LABELS.map((label, idx) => {
                const v = idx + 1;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={answers[item.id] === v}
                    className={answers[item.id] === v ? 'selected' : ''}
                    onClick={() => setAnswers((a) => ({ ...a, [item.id]: v }))}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="spread">
        <button onClick={() => (page > 0 ? goTo(page - 1) : navigate(isRetake ? 'today' : 'welcome'))}>← Back</button>
        <button className="primary" disabled={!pageDone} onClick={() => goTo(page + 1)}>
          Next →
        </button>
      </div>
      <p className="refs" style={{ marginTop: 16 }}>
        Items from the International Personality Item Pool (IPIP) 50-item Big-Five Factor Markers (Goldberg, 1992),
        public domain. See ipip.ori.org.
      </p>
    </div>
  );
}

/** IPIP items omit the subject ("Am the life of the party."); read them as "I am…". */
function firstPerson(text: string): string {
  return `I ${text[0].toLowerCase()}${text.slice(1)}`;
}
