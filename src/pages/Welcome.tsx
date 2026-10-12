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
          Personality traits are not fixed. They change across life, and studies suggest that people who set out to
          change a trait can shift it modestly over a few months, at least in how they rate themselves. Turning the
          goal into specific weekly steps with if-then plans can help. Trait Trainer is built around that research.
        </p>
        <RefList ids={['hudson2015', 'stieger2021', 'haehner2024']} />
      </section>

      <div className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Measure.</strong> Take a free, scientifically validated 50-item Big Five questionnaire (about 5
            minutes).
          </li>
          <li>
            <strong>Choose one goal and commit to it.</strong> For example: be more conscientious, warmer, more
            outgoing, more open, or calmer and more emotionally stable. Write down why it matters to you. You can add a
            second trait once the first feels settled.
          </li>
          <li>
            <strong>Take on weekly challenges.</strong> Small, concrete actions matched to your goal, each paired with
            an <em>if-then plan</em> that says exactly when and where you'll do it.
            <RefList ids={['hudson2015', 'hudson2019']} />
          </li>
          <li>
            <strong>Follow a stepwise path.</strong> Small, sure steps first, then habits, then consolidation, then
            maintenance. Check in daily, reflect weekly, and re-measure every 4 weeks over a 12-week program.
          </li>
        </ol>
        <p className="muted">
          These steps are loosely modeled on the PEACH app trial. There, each person picked one goal, set a new if-then
          plan every week, and had two app conversations a day with reflection and progress feedback, for about 3
          months. The order of the path, adding a second trait later, automatic difficulty changes and re-measuring
          every 4 weeks are this app's own choices and were not part of that trial.
        </p>
        <RefList ids={['stieger2021']} />
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
            <strong>What to expect.</strong> In controlled studies, structured programs like this one led to measurable
            change in the targeted trait within 2–3 months, mostly in how people rated themselves. By rough estimates,
            that is several times faster than personality changes on its own, and similar to what therapy achieves for
            people without a mental-health diagnosis. Doing more of the weekly practices went with more change; wanting
            it alone did little. Friends and family see less of the change than you do, often later.
            <RefList ids={['haehner2024', 'wright2026', 'hudson2021', 'baranski2020', 'stieger2021']} />
          </li>
          <li>
            Progress goes up and down, and stretching yourself can feel tiring or uncomfortable at times. Changes can
            also affect the people around you. Ease off if it feels like too much. Side effects of these programs
            have barely been studied, so researchers recommend saying this up front.
            <RefList ids={['haehner2026', 'asselmann2026']} />
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
