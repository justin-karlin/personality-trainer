import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { RefList } from '../components/common';

export function Welcome() {
  const { state, update } = useStore();
  const [agreed, setAgreed] = useState(state.acceptedDisclaimer);

  function start() {
    update((s) => ({ ...s, acceptedDisclaimer: true }));
    navigate(state.assessments.length ? 'today' : 'assess');
  }

  return (
    <div>
      <section className="hero">
        <h1>Grow the traits you choose, one small action at a time.</h1>
        <p className="muted">
          Personality traits are not fixed. They change across life, and studies show people can deliberately
          shift them, if they turn the goal into concrete, repeated behaviour. Trait Trainer is built around that
          research.
        </p>
      </section>

      <div className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Measure.</strong> Take a free, scientifically validated 50-item Big Five questionnaire (about 5
            minutes).
          </li>
          <li>
            <strong>Choose one or two goals.</strong> For example: be more conscientious, warmer, more outgoing, more
            open, or calmer and more emotionally stable. Then write down why it matters to you.
          </li>
          <li>
            <strong>Take on weekly challenges.</strong> Small, concrete actions matched to your goal, each paired with
            an <em>if-then plan</em> that says exactly when and where you'll do it.
          </li>
          <li>
            <strong>Check in daily, reflect weekly.</strong> Log what you did, notice what helped, and let the app adjust
            the difficulty.
          </li>
          <li>
            <strong>Re-measure every 4 weeks</strong> over a 12-week program to see how you're changing.
          </li>
        </ol>
        <RefList ids={['hudson2015', 'hudson2019', 'stieger2021', 'roberts2017']} />
      </div>

      <div className="card soft">
        <h3>Before you start</h3>
        <ul>
          <li>
            This is a self-improvement tool, <strong>not therapy or a diagnosis</strong>. If you're struggling with
            anxiety, depression, or anything that feels overwhelming, please talk to a professional. Evidence-based
            therapy works well.
          </li>
          <li>
            If you are in crisis or thinking about harming yourself, call or text <strong>988</strong> (US) or find a
            line in your country at{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </li>
          <li>
            Expect <strong>gradual</strong> change. In studies, average changes over a few months are real but modest,
            and they come from doing the challenges, not from wanting to change.
          </li>
          <li>Your answers are stored only in this browser. Nothing is sent to a server.</li>
        </ul>
        <label className="row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand this is not a substitute for professional care.</span>
        </label>
      </div>

      <div className="row">
        <button className="primary" disabled={!agreed} onClick={start}>
          {state.assessments.length ? 'Continue' : 'Start the questionnaire →'}
        </button>
        <a className="btn" href="#/science">
          Read the science first
        </a>
      </div>
    </div>
  );
}
