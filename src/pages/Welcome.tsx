import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { RefList } from '../components/common';
import { Icon } from '../components/Icon';
import { IosInstallSteps, TransferPanel } from '../components/TransferPanel';
import { isInstalled, isIosBrowser, requestPersistentStorage } from '../lib/transfer';

export function Welcome() {
  const { state, update } = useStore();
  const [agreed, setAgreed] = useState(state.acceptedDisclaimer);

  const iosBrowser = isIosBrowser();
  const freshInstall = isInstalled() && !state.assessments.length;

  function start() {
    requestPersistentStorage();
    update((s) => ({ ...s, acceptedDisclaimer: true }));
    navigate(state.assessments.length ? 'today' : 'assess');
  }

  return (
    <div>
      <section className="hero">
        <h1>Your personality isn't set in stone. You can shape it.</h1>
        <p className="lead">
          Traits like conscientiousness, warmth and calm predict how your relationships, work and health turn out.
          Research now shows that people can change them on purpose, through small actions practised week after week. Trait
          Trainer turns that research into a 12-week plan built around your own goal.
        </p>
        <div className="page-actions" style={{ marginTop: 4 }}>
          <button
            className="primary"
            onClick={() => document.getElementById('before-you-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Get started
          </button>
        </div>
      </section>

      {iosBrowser && (
        <div className="card tip warn">
          <h3>On iPhone? Install the app first</h3>
          <p>
            Safari and the Home Screen app keep separate storage, so progress you make here won't appear in the
            installed app.
          </p>
          <IosInstallSteps />
        </div>
      )}

      <div className="grid-2 benefits">
        <div className="card">
          <span className="benefit-icon">
            <Icon name="trend" size={22} />
          </span>
          <h3>Faster than natural change</h3>
          <p>
            On average, people in structured programs shifted their chosen trait about five times as much as people
            naturally change over the same months, though the effect is small and the estimate rough.
          </p>
          <RefList ids={['haehner2024']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="clock" size={22} />
          </span>
          <h3>Change that seems to last</h3>
          <p>
            In the studies that checked back, gains seemed to last up to a year. In one coaching-app trial, people
            aiming to be calmer kept rating themselves calmer a year after it ended, though only about 1 in 10 users
            answered then.
          </p>
          <RefList ids={['haehner2024', 'stieger2024']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="check" size={22} />
          </span>
          <h3>In your hands</h3>
          <p>
            Commitment to the goal was the most consistent predictor of change, and more practice went with more
            growth. Students who chose emotional stability and did about eight challenges a week were predicted to
            grow clearly in it over 16 weeks; at two a week, not at all.
          </p>
          <RefList ids={['olaru2026', 'hudson2021']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="heart" size={22} />
          </span>
          <h3>Worth the effort</h3>
          <p>
            Traits predict divorce, success at work and even how long people live, about as well as IQ or income and
            education do. In one coaching-app trial, life satisfaction rose too, more so for people whose traits
            changed more.
          </p>
          <RefList ids={['roberts2007', 'olaru2023']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="users" size={22} />
          </span>
          <h3>Others notice</h3>
          <p>
            In a coaching-app trial, friends and family also rated rises in traits people wanted more of, though less
            strongly than people rated themselves.
          </p>
          <RefList ids={['stieger2021']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="sprout" size={22} />
          </span>
          <h3>Built on your strengths</h3>
          <p>
            Your results show what you already do well, and each weekly reflection starts with what went well and
            which strengths you used.
          </p>
        </div>
      </div>

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
          <li>
            <strong>Get follow-through support.</strong> A daily calendar reminder, someone who checks in on you, and a
            plan for missed days, because the people who keep practising are the ones who change most.
          </li>
        </ol>
        <p className="muted">
          These steps follow the methods of controlled trials, especially PEACH, a randomized trial of a coaching app. A
          few details, like the order of the path, are this app's own; the Science page says which.
        </p>
        <RefList ids={['stieger2021']} />
      </div>

      <div className="card soft">
        <h2 id="before-you-start">Before you start</h2>
        {freshInstall && (
          <details className="card">
            <summary>Already started in Safari or on another device?</summary>
            <p className="muted">
              In the browser where you started, open Settings → Move your data and copy the transfer code. Then paste it
              here.
            </p>
            <TransferPanel mode="paste" />
          </details>
        )}
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
            <strong>What to expect.</strong> Change builds over weeks, not days, and progress goes up and down. Most of
            the evidence comes from people's own ratings, and friends and family see part of the change, sometimes only
            later. In the studies, more practice went with more change.
            <RefList ids={['haehner2024', 'stieger2021', 'wright2026', 'hudson2021']} />
          </li>
          <li>
            Stretching yourself can feel tiring or uncomfortable at times, and changes can affect the people around
            you. Ease off if it feels like too much. Side effects of these programs have barely been studied, so
            researchers recommend saying this up front.
            <RefList ids={['haehner2026', 'asselmann2026']} />
          </li>
          <li>
            Your answers are stored only in this browser. The app counts anonymous usage (which screens are opened,
            how many check-ins) with no cookies, and never sends your answers or scores. You can turn this off in
            Settings.
          </li>
        </ul>
        <label className="consent">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand this is not a substitute for professional care.</span>
        </label>
      </div>

      <div className="page-actions">
        <button className="primary" disabled={!agreed} onClick={start} aria-describedby={agreed ? undefined : 'start-hint'}>
          {state.assessments.length ? 'Continue' : 'Start the questionnaire →'}
        </button>
        {!agreed && <small id="start-hint">Tick the box above to continue.</small>}
        <a className="btn" href="#/science">
          Read the science first
        </a>
      </div>
    </div>
  );
}
