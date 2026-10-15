import { PlanCoach } from '../components/PlanCoach';
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { Challenge, Commitment, TraitId } from '../types';
import { CHALLENGES } from '../data/challenges';
import { TECHNIQUES } from '../data/techniques';
import { TRAITS } from '../data/traits';
import {
  currentWeekIndex,
  findWeek,
  previousPlannedWeek,
  isProgramComplete,
  recommendCount,
  recommendLevel,
  suggestChallenges,
  weekStart,
} from '../lib/program';
import { addDays, formatDate, today } from '../lib/dates';
import { planHint } from '../lib/plans';
import { revisePlan } from '../lib/actions';
import { EvidencePill, RefList } from '../components/common';

interface Draft {
  ifThen: string;
  confidence: number;
  target: number;
  /** The wording started from an AI coach suggestion. */
  coachDrafted?: boolean;
}

const LEVEL_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Stretch (optional)' } as const;
const SHOW_INITIALLY = 5;

export function Plan() {
  const { state, update } = useStore();
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  const existing = findWeek(state, idx);
  const prev = previousPlannedWeek(state, idx);
  const start = weekStart(state, idx);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      (existing?.commitments ?? []).map((c) => [
        c.challengeId,
        { ifThen: c.ifThen, confidence: c.confidence, target: c.target, coachDrafted: c.coachDrafted },
      ]),
    ),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectedIds = Object.keys(drafts);
  const valid = selectedIds.length > 0 && selectedIds.every((id) => drafts[id].ifThen.trim().length > 0);
  const maintenance = isProgramComplete(state, date);
  const suggestedCount = recommendCount(prev, maintenance);

  function toggle(ch: Challenge) {
    setDrafts((d) => {
      if (d[ch.id]) {
        const { [ch.id]: _removed, ...rest } = d;
        return rest;
      }
      return { ...d, [ch.id]: { ifThen: '', confidence: 7, target: ch.perWeek } };
    });
  }

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  }

  function save() {
    const commitments: Commitment[] = selectedIds.map((id) => {
      const { ifThen, confidence, target, coachDrafted } = drafts[id];
      const old = existing?.commitments.find((c) => c.challengeId === id);
      // Keep the same record (and its logged outcomes); a changed wording is kept as a revision.
      if (old) return { ...revisePlan(old, ifThen.trim(), date, !!coachDrafted), confidence, target };
      return { challengeId: id, ifThen: ifThen.trim(), confidence, target, completions: [], log: {}, coachDrafted: !!coachDrafted };
    });
    update((s) => ({
      ...s,
      weeks: [...s.weeks.filter((w) => w.weekIndex !== idx), { weekIndex: idx, startDate: start, commitments, reflection: existing?.reflection }],
    }));
    navigate('today');
  }

  return (
    <div>
      <h1>Plan week {idx + 1}</h1>
      <p className="muted">
        {formatDate(start)} – {formatDate(addDays(start, 6))}. Choose about {suggestedCount} challenge
        {suggestedCount > 1 ? 's' : ''} per goal that you're confident you'll actually finish. In one study of college
        students, finishing challenges went with more self-reported growth in some traits. Just signing up for them
        did not.
      </p>
      <RefList ids={['hudson2019']} />
      {maintenance && (
        <div className="card tip">
          <small>
            <strong>Maintenance.</strong> The program is over, so keep one favourite challenge per goal going as a
            habit. Gains in self-ratings mostly held after programs ended, but they rarely grew without practice.
          </small>
          <RefList ids={['stieger2024']} />
        </div>
      )}

      {state.goals.map((g) => (
        <TraitSection
          key={g.trait}
          trait={g.trait}
          why={g.why}
          level={recommendLevel(prev, g.trait, CHALLENGES)}
          prevWeek={prev}
          drafts={drafts}
          expanded={!!expanded[g.trait]}
          onExpand={() => setExpanded({ ...expanded, [g.trait]: !expanded[g.trait] })}
          onToggle={toggle}
          onPatch={patch}
        />
      ))}

      <div className="card soft">
        <small>
          <strong>Why if-then plans?</strong> Deciding in advance exactly <em>when</em> and <em>where</em> you'll act
          ("If it's 7:30 and I've poured my coffee, then I'll…") clearly improves follow-through compared with good
          intentions alone. A review of 94 tests found a medium-to-large effect. It hands control of the behaviour
          to a cue in your environment.
        </small>
        <RefList ids={['gollwitzer2006']} />
      </div>

      <div className="page-actions">
        <button className="primary" disabled={!valid} onClick={save}>
          {existing ? 'Update plan' : 'Commit to this week'}
        </button>
        {!valid && selectedIds.length > 0 && <small>Write an if-then plan for each challenge.</small>}
        {existing && (
          <button className="ghost" onClick={() => navigate('today')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function TraitSection(props: {
  trait: TraitId;
  why: string;
  level: 1 | 2 | 3;
  prevWeek: ReturnType<typeof previousPlannedWeek>;
  drafts: Record<string, Draft>;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (c: Challenge) => void;
  onPatch: (id: string, p: Partial<Draft>) => void;
}) {
  const { trait, why, level, prevWeek, drafts, expanded, onExpand, onToggle, onPatch } = props;
  const suggestions = useMemo(() => suggestChallenges(trait, level, CHALLENGES, prevWeek), [trait, level, prevWeek]);
  // Always keep already-selected challenges visible even if they fall below the fold.
  const visible = expanded
    ? suggestions
    : suggestions.filter((c, i) => i < SHOW_INITIALLY || drafts[c.id]);

  return (
    <section style={{ margin: '24px 0 22px' }}>
      <h2 style={{ margin: 0 }}>{TRAITS[trait].goalName}</h2>
      <p className="muted" style={{ margin: '2px 0 8px' }}>Why: {why}</p>
      <span className="pill" style={{ marginBottom: 10 }}>
        Suggested level: {LEVEL_LABEL[level]}
      </span>
      <div className="stack">
        {visible.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            draft={drafts[c.id]}
            onToggle={() => onToggle(c)}
            onPatch={(p) => onPatch(c.id, p)}
          />
        ))}
      </div>
      {suggestions.length > SHOW_INITIALLY && (
        <button className="ghost" onClick={onExpand} style={{ marginTop: 6 }}>
          {expanded ? 'Show fewer' : `Show all ${suggestions.length} challenges`}
        </button>
      )}
    </section>
  );
}

function ChallengeCard({
  challenge: c,
  draft,
  onToggle,
  onPatch,
}: {
  challenge: Challenge;
  draft?: Draft;
  onToggle: () => void;
  onPatch: (p: Partial<Draft>) => void;
}) {
  const technique = TECHNIQUES.find((t) => t.id === c.technique);
  return (
    <div className={`card pick-card ${draft ? 'selectable selected' : ''}`} style={{ marginBottom: 0 }}>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="checkbox" className="pick" checked={!!draft} onChange={onToggle} aria-label={`Select ${c.title}`} />
        <div>
          <div className="row" style={{ gap: 6, marginBottom: 4, paddingRight: 44 }}>
            <span className="pill">{LEVEL_LABEL[c.level]}</span>
            <span className="pill">
              {c.perWeek}× / week · ~{c.minutes} min
            </span>
            {technique && <EvidencePill level={technique.evidence} technique />}
          </div>
          <h3 style={{ margin: '4px 0' }}>{c.title}</h3>
          <p style={{ margin: 0 }}>{c.instructions}</p>
          {technique && <small className="fine">Technique: {technique.name}</small>}
        </div>
      </label>

      {draft && (
        <div className="stack" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Your if-then plan</span>
            <textarea
              value={draft.ifThen}
              onChange={(e) => onPatch({ ifThen: e.target.value })}
              placeholder={c.ifThenExample}
            />
            {planHint(draft.ifThen) ? (
              <small style={{ color: 'var(--warn)' }}>{planHint(draft.ifThen)}</small>
            ) : (
              <small>Example: {c.ifThenExample}</small>
            )}
          </label>
          <PlanCoach challenge={c} plan={draft.ifThen} onUse={(ifThen) => onPatch({ ifThen, coachDrafted: true })} />
          <div className="grid-2">
            <label className="field">
              <span className="spread" style={{ flexWrap: 'nowrap' }}>
                <span>Times this week</span>
                <strong>{draft.target}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={7}
                value={draft.target}
                onChange={(e) => onPatch({ target: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span>How confident are you that you'll do it?</span>
                <strong style={{ whiteSpace: 'nowrap' }}>{draft.confidence}/10</strong>
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={draft.confidence}
                onChange={(e) => onPatch({ confidence: Number(e.target.value) })}
              />
            </label>
          </div>
          {draft.confidence < 7 && (
            <div className="card tip warn" style={{ margin: 0, padding: 12 }}>
              <small>
                Below 7/10? Make it smaller: fewer times, a shorter version, or an easier challenge. In one study,
                people who took on more challenges without finishing more fell slightly behind their peers in most
                self-rated traits.
              </small>
              <RefList ids={['hudson2019']} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
