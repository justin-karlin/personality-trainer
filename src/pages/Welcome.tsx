import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
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
        <p className="lead">Small daily habits, for 12 weeks.</p>
      </section>

      {iosBrowser && (
        <div className="card tip warn">
          <h3>Install the app first</h3>
          <p>Safari and the app don't share data.</p>
          <IosInstallSteps />
        </div>
      )}

      {freshInstall && (
        <details>
          <summary>Started on another device?</summary>
          <p>On the old device, copy the code in Settings.</p>
          <TransferPanel mode="paste" />
        </details>
      )}

      <div className="card soft">
        <ul>
          <li>
            This is <strong>not therapy or a diagnosis</strong>.
          </li>
          <li>
            In crisis? Call or text <strong>988</strong> (US) or{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </li>
          <li>We count anonymous usage. Turn it off in Settings.</li>
        </ul>
        <label className="consent">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand this is not a substitute for professional care.</span>
        </label>
      </div>

      <div className="page-actions">
        <button className="primary" disabled={!agreed} onClick={start} aria-describedby={agreed ? undefined : 'start-hint'}>
          {state.assessments.length ? 'Continue' : 'Start →'}
        </button>
        {!agreed && <small id="start-hint">Tick the box first.</small>}
      </div>

      <p className="center-link">
        <a href="#/science">Does it work?</a>
      </p>
    </div>
  );
}
