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
          Get support
        </h2>
        <p>Often low or anxious? See a professional.</p>
        <ul>
          <li>
            <strong>Emergency:</strong> call your local number
          </li>
          <li>
            <strong>US crisis:</strong> call or text <strong>988</strong>
          </li>
          <li>
            <strong>Abuse (US):</strong> <strong>1-800-799-7233</strong>
          </li>
          <li>
            <strong>Elsewhere:</strong>{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Program</h2>
        <div className="action-grid">
          <button onClick={() => navigate('goals')}>Edit goals</button>
          <button onClick={() => navigate('reflect')}>Reflect</button>
          <button onClick={() => navigate('assess')}>Retake quiz</button>
          <button onClick={() => navigate('results')}>Results</button>
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
        </label>
      </section>

      <section className="card stack" id="move-data">
        <h2>Move your data</h2>
        {isIosBrowser() && <IosInstallSteps />}
        <TransferPanel />
      </section>

      <section className="card stack">
        <h2>Your data</h2>
        <p className="muted">
          {isNative() ? 'Stored only in this app. Deleting the app erases it.' : 'Stored only here. Clearing browser data erases it.'}
        </p>
        <label className="consent">
          <input type="checkbox" checked={shareCounts} onChange={(e) => toggleCounts(e.target.checked)} />
          <span>Share anonymous usage counts (never your answers)</span>
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
              Replace all your data with <strong>{pendingImport.name}</strong>? ({pendingImport.data.assessments.length}{' '}
              questionnaires, {pendingImport.data.weeks.length} weeks)
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
            <p>Delete everything on this device? This can't be undone.</p>
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
        {message && <p role="status">{message}</p>}
        <p style={{ margin: 0 }}>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>
      </section>
    </div>
  );
}
