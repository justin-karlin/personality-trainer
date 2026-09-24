import { useRef, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { emptyState, parseState } from '../lib/storage';
import { today } from '../lib/dates';

export function Settings() {
  const { state, update, replace } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trait-trainer-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const next = parseState(JSON.parse(await file.text()));
      if (!confirm('Replace all data in this browser with the imported file?')) return;
      replace(next);
      setMessage('Data imported.');
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`);
    }
  }

  function reset() {
    if (!confirm('Delete all your answers, goals, plans and check-ins from this browser? This cannot be undone.')) return;
    replace(emptyState());
    navigate('welcome');
  }

  return (
    <div>
      <h1>Settings</h1>

      <section className="card care" style={{ background: 'var(--care-soft)', borderColor: 'transparent' }}>
        <h2>Support resources</h2>
        <p>
          Trait Trainer is a self-improvement tool, not a treatment. Please reach out to a professional if you feel
          persistently down, anxious, or overwhelmed. Self-guided exercises work best alongside, not instead of,
          proper care when you need it.
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
            <strong>Elsewhere:</strong>{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>{' '}
            lists free, confidential lines by country.
          </li>
          <li>
            A GP/primary-care doctor can refer you to evidence-based therapy (e.g. CBT), which has strong evidence for
            reducing anxiety, low mood and neuroticism itself.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Program</h2>
        <div className="row">
          <button onClick={() => navigate('goals')}>Edit goals</button>
          <button onClick={() => navigate('reflect')}>Weekly reflection</button>
          <button onClick={() => navigate('assess')}>Retake questionnaire</button>
          <button onClick={() => navigate('results')}>Latest results</button>
        </div>
        <label className="field">
          <span>Program length: {state.programWeeks} weeks</span>
          <input
            type="range"
            min={4}
            max={24}
            step={2}
            value={state.programWeeks}
            onChange={(e) => update((s) => ({ ...s, programWeeks: Number(e.target.value) }))}
          />
          <small>Research programs typically ran 10–16 weeks. You can keep going after the program ends.</small>
        </label>
      </section>

      <section className="card stack">
        <h2>Your data</h2>
        <p className="muted">
          Everything is stored only in this browser (localStorage). Export a backup to move to another device or keep
          a copy. Clearing your browser data will erase it.
        </p>
        <div className="row">
          <button onClick={exportData}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
              e.target.value = '';
            }}
          />
          <button className="danger" onClick={reset}>
            Delete all data
          </button>
        </div>
        {message && <small>{message}</small>}
      </section>
    </div>
  );
}
