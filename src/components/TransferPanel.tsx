import { useState } from 'react';
import { useStore } from '../store';
import type { AppState } from '../types';
import { makeTransferCode, readTransferCode } from '../lib/transfer';

/** Copy this browser's data as a transfer code, or paste one from another browser or the installed app. */
export function TransferPanel({ mode = 'both' }: { mode?: 'both' | 'paste' }) {
  const { state, replace } = useStore();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<AppState | null>(null);
  const hasData = state.assessments.length > 0 || state.goals.length > 0;

  async function copy() {
    const text = await makeTransferCode(state);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied. Open the installed app (or your other device) and paste it under Settings → Move your data.');
    } catch {
      setCode(text);
      setMessage('Copy the code below (select all, then Copy).');
    }
  }

  async function check(text: string) {
    try {
      const data = await readTransferCode(text);
      setPending(data);
      setMessage('');
    } catch (e) {
      setPending(null);
      setMessage((e as Error).message);
    }
  }

  function apply() {
    if (!pending) return;
    replace(pending);
    setPending(null);
    setCode('');
    setMessage('Your data is here. Carry on where you left off.');
  }

  return (
    <div className="stack">
      {mode === 'both' && hasData && (
        <div className="row">
          <button onClick={() => void copy()}>Copy transfer code</button>
        </div>
      )}
      <label className="field">
        <span>Paste a transfer code</span>
        <textarea
          rows={3}
          value={code}
          placeholder="TT1.…"
          onChange={(e) => {
            setCode(e.target.value);
            setPending(null);
            setMessage('');
          }}
        />
      </label>
      <div className="row">
        <button disabled={!code.trim()} onClick={() => void check(code)}>
          Load from code
        </button>
      </div>
      {pending && (
        <div className="card tip warn" style={{ margin: 0 }}>
          <p>
            Replace {hasData ? 'everything here' : 'this empty app'} with the transferred data ({pending.assessments.length}{' '}
            questionnaires, {pending.weeks.length} planned weeks, {Object.keys(pending.checkins).length} check-ins)?
          </p>
          <div className="row">
            <button className="primary" onClick={apply}>
              Use this data
            </button>
            <button className="ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

/** How to install on iPhone, and why it matters for your data. */
export function IosInstallSteps() {
  return (
    <ol className="steps">
      <li>
        Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.
      </li>
      <li>Open Trait Trainer from your Home Screen and start there.</li>
    </ol>
  );
}
