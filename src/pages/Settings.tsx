import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import type { AppState } from '../types';
import { emptyState, parseState } from '../lib/storage';
import { today } from '../lib/dates';
import { analyticsOff, setAnalyticsOff } from '../lib/analytics';
import { IosInstallSteps, TransferPanel } from '../components/TransferPanel';
import { isIosBrowser } from '../lib/transfer';
import { PUBLIC_URL, isNative } from '../lib/native';

// In the App Store app the page address is internal, so the policy opens on the public website.
const PRIVACY_URL = isNative() ? `${PUBLIC_URL}privacy.html` : 'privacy.html';

export function Settings() {
  const { state, update, replace } = useStore();
  const [shareCounts, setShareCounts] = useState(() => !analyticsOff());
  const toggleCounts = (on: boolean) => {
    setAnalyticsOff(!on);
    setShareCounts(on);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  // Confirmations happen in the page (no window.confirm), so they work in embedded views too.
  const [pendingImport, setPendingImport] = useState<{ name: string; data: AppState } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trait-trainer-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Some browsers (Safari) read the file after click returns, so revoke later.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function readImport(file: File) {
    try {
      setPendingImport({ name: file.name, data: parseState(JSON.parse(await file.text())) });
      setMessage('');
    } catch (e) {
      setPendingImport(null);
      setMessage(`Couldn't import ${file.name}: ${(e as Error).message}`);
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    replace(pendingImport.data);
    setPendingImport(null);
    setMessage('Backup imported.');
  }

  function reset() {
    replace(emptyState());
    navigate('welcome');
  }

  return (
    <div>
      <h1>Settings</h1>

      <section className="card">
        <h2 className="row" style={{ gap: 10 }}>
          <span className="tip-icon" style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--care-soft)', color: 'var(--care)' }}>
            <Icon name="heart" size={18} />
          </span>
          Support resources
        </h2>
        <p>
          Trait Trainer is a self-improvement tool, not a treatment. Please reach out to a professional if you feel
          persistently down, anxious, or overwhelmed. If you need proper care, get it, and use self-guided exercises
          only alongside it.
        </p>
        <ul>
          <li>
            <strong>In immediate danger:</strong> call your local emergency number.
          </li>
          <li>
            <strong>US:</strong> call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline), or text HOME to
            741741.
          </li>
          <li>
            <strong>If someone is hurting or frightening you (US):</strong> National Domestic Violence Hotline,{' '}
            <strong>1-800-799-7233</strong>, or text START to 88788.
          </li>
          <li>
            <strong>Elsewhere:</strong>{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>{' '}
            lists free, confidential lines by country.
          </li>
          <li>
            A GP/primary-care doctor can refer you to evidence-based therapy (e.g. CBT), which has strong evidence for
            reducing anxiety and low mood. Neuroticism scores often fall during therapy too, but it is less clear how
            much of that drop the therapy itself causes.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Program</h2>
        <div className="action-grid">
          <button onClick={() => navigate('goals')}>Edit goals</button>
          <button onClick={() => navigate('reflect')}>Weekly reflection</button>
          <button onClick={() => navigate('assess')}>Retake questionnaire</button>
          <button onClick={() => navigate('results')}>Latest results</button>
        </div>
        <label className="field">
          <span className="spread" style={{ flexWrap: 'nowrap' }}>
            <span>Program length</span>
            <strong>{state.programWeeks} weeks</strong>
          </span>
          <input
            type="range"
            min={4}
            max={24}
            step={2}
            value={state.programWeeks}
            onChange={(e) => update((s) => ({ ...s, programWeeks: Number(e.target.value) }))}
          />
          <small>Research programs mostly ran about 6–16 weeks, about 10 on average. You can keep going after the program ends.</small>
        </label>
      </section>

      <section className="card stack" id="move-data">
        <h2>Move your data</h2>
        <p className="muted">
          Your data lives only on this device{isNative() ? ', in this app' : ', in this browser'}. To continue somewhere
          else (another device, or the installed app on iPhone, which keeps its own storage), copy a transfer code here
          and paste it there.
        </p>
        {isIosBrowser() && <IosInstallSteps />}
        <TransferPanel />
      </section>

      <section className="card stack">
        <h2>Your data</h2>
        <p className="muted">
          {isNative()
            ? 'Everything is stored only on this device, inside the app, and is included in your iPhone’s backup. Deleting the app erases it.'
            : 'Everything is stored only on this device, in this browser. Clearing your browser data erases it.'}{' '}
          {isNative()
            ? 'To move it or keep a copy, use a transfer code (above).'
            : 'Export a backup to move to another device or keep a copy.'}
        </p>
        <label className="consent">
          <input type="checkbox" checked={shareCounts} onChange={(e) => toggleCounts(e.target.checked)} />
          <span>
            Share anonymous usage counts: which screens are opened and milestones such as check-ins, with no cookies
            and never your answers or scores. They help show whether the app is useful.
          </span>
        </label>
        <div className="row">
          {/* The iPhone app's web view can't download files; it uses the transfer code instead. */}
          {!isNative() && <button onClick={exportData}>Export backup</button>}
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readImport(f);
              e.target.value = '';
            }}
          />
          <button className="danger" onClick={() => setConfirmReset(true)}>
            Delete all data
          </button>
        </div>
        {pendingImport && (
          <div className="card tip warn" style={{ margin: 0 }}>
            <p>
              Replace everything on this device with the backup <strong>{pendingImport.name}</strong> (
              {pendingImport.data.assessments.length} questionnaires, {pendingImport.data.weeks.length} planned weeks)?
            </p>
            <div className="row">
              <button className="primary" onClick={applyImport}>
                Replace my data
              </button>
              <button className="ghost" onClick={() => setPendingImport(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {confirmReset && (
          <div className="card tip care" style={{ margin: 0 }}>
            <p>Delete all your answers, goals, plans and check-ins from this device? This can't be undone.</p>
            <div className="row">
              <button className="danger solid" onClick={reset}>
                Delete everything
              </button>
              <button className="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && <small>{message}</small>}
        <small>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </small>
      </section>
    </div>
  );
}
