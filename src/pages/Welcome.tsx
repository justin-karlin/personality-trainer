import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { RefList } from '../components/common';
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
        <h1>Follow through. Get along better.</h1>
        <p className="lead">Small weekly challenges, built around one goal, over 12 weeks.</p>
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
          <p>Safari and the Home Screen app don't share data.</p>
          <IosInstallSteps />
        </div>
      )}

      <div className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>Take a 5-minute questionnaire.</li>
          <li>Pick one goal and say why it matters.</li>
          <li>Do small challenges each week, with a plan for when and where.</li>
        </ol>
        <details>
          <summary>Does it work?</summary>
          <ul>
            <li>
              <strong>Faster than natural change.</strong> On average, people in structured programs shifted their
              chosen trait about five times as much as people change on their own. The effect is small and the estimate
              rough.
              <RefList ids={['haehner2024']} />
            </li>
            <li>
              <strong>It seems to last.</strong> Where studies checked back, gains seemed to hold for up to a year (few
              people answered the later checks).
              <RefList ids={['haehner2024', 'stieger2024']} />
            </li>
            <li>
              <strong>It's in your hands.</strong> Commitment and more practice went with more change.
              <RefList ids={['olaru2026', 'hudson2021']} />
            </li>
            <li>
              <strong>Worth the effort.</strong> Traits predict work, relationships and health about as well as IQ or
              income and education do. In one app trial, life satisfaction rose as traits changed.
              <RefList ids={['roberts2007', 'olaru2023']} />
            </li>
            <li>
              <strong>Others notice.</strong> Friends and family saw some of the change too, though less than people saw
              in themselves.
              <RefList ids={['stieger2021']} />
            </li>
          </ul>
          <p>
            The steps follow controlled trials, mainly PEACH, a coaching-app trial. A few details are this app's own;
            the Science page says which.
          </p>
          <RefList ids={['hudson2015', 'hudson2019', 'stieger2021']} />
        </details>
      </div>

      <div className="card soft">
        <h2 id="before-you-start">Before you start</h2>
        {freshInstall && (
          <details className="card">
            <summary>Already started in Safari or on another device?</summary>
            <p>In Safari or on your other device, open Settings → Move your data and copy the code. Paste it here.</p>
            <TransferPanel mode="paste" />
          </details>
        )}
        <ul>
          <li>
            This is <strong>not therapy or a diagnosis</strong>. If you're struggling, please talk to a professional.
          </li>
          <li>
            In crisis? Call or text <strong>988</strong> (US) or find a line at{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </li>
          <li>Change takes weeks. Stretching yourself can feel tiring, so ease off if it's too much.</li>
          <li>
            Your answers stay on this device. The app counts anonymous usage, with no cookies and never your answers.
            You can turn this off in Settings.
          </li>
        </ul>
        <details>
          <summary>What to expect</summary>
          <p>
            Most of the evidence comes from people's own ratings. Friends and family see part of the change, sometimes
            only later. More practice went with more change.
          </p>
          <RefList ids={['haehner2024', 'stieger2021', 'wright2026', 'hudson2021']} />
          <p>
            Progress goes up and down. Changes can affect the people around you. Side effects of these programs have
            barely been studied, so researchers recommend saying this up front.
          </p>
          <RefList ids={['haehner2026', 'asselmann2026']} />
        </details>
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
