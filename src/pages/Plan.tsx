import { PlanCoach } from '../components/PlanCoach';
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { BarrierId, Challenge, Commitment, Goal, TraitId, WeekPlan } from '../types';
import { BARRIERS, barrierById } from '../data/barriers';
import { CHALLENGES, challengeById } from '../data/challenges';
import { TECHNIQUES } from '../data/techniques';
import { AGREEABLENESS_NOTE, TRAITS } from '../data/traits';
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
import { joinIfThen, planHint, splitIfThen } from '../lib/plans';
import { highlightIfThen } from './Today';
import { revisePlan } from '../lib/actions';
import { EvidencePill, RefList } from '../components/common';

interface Draft {
  ifThen: string;
  confidence: number;
  target: number;
  /** The wording started from an AI coach suggestion. */
  coachDrafted?: boolean;
  /** The two parts of the template form; `ifThen` is rebuilt from them when they change. */
  cue: string;
  action: string;
  /** Writing the whole sentence freely instead of with the two-part form. */
  free: boolean;
}

/** A draft for a plan sentence: the two-part form when the sentence fits it, free text otherwise. */
function draftParts(ifThen: string): Pick<Draft, 'cue' | 'action' | 'free'> {
  const parts = splitIfThen(ifThen);
  return parts ? { ...parts, free: false } : { cue: '', action: '', free: ifThen.trim().length > 0 };
}

/** Last week's plans the user chose to keep, with the reflection's change applied. */
function carriedPlans(prev: WeekPlan | undefined): (Commitment & { fromReflection: boolean })[] {
  if (!prev) return [];
  const r = prev.reflection;
  return prev.commitments
    .filter((c) => c.next === 'repeat' || c.next === 'change' || (r?.applyTo === c.challengeId && r.nextTime))
    .map((c) => {
      const apply = r?.applyTo === c.challengeId && !!r.nextTime.trim();
      return { ...c, ifThen: apply ? r!.nextTime.trim() : c.ifThen, fromReflection: apply };
    });
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

  // A new week starts from last week's reflection: plans marked to repeat carry over, and the
  // "do differently" answer replaces the plan it was applied to. Everything stays editable.
  const [carried] = useState(() =>
    existing
      ? []
      : carriedPlans(prev).filter((c) => state.goals.some((g) => g.trait === challengeById(c.challengeId)?.trait)),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    existing
      ? Object.fromEntries(
          existing.commitments.map((c) => [
            c.challengeId,
            { ifThen: c.ifThen, confidence: c.confidence, target: c.target, coachDrafted: c.coachDrafted, ...draftParts(c.ifThen) },
          ]),
        )
      : Object.fromEntries(
          carried.map((c) => [
            c.challengeId,
            { ifThen: c.ifThen, confidence: c.confidence, target: c.target, ...draftParts(c.ifThen) },
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
      return { ...d, [ch.id]: { ifThen: '', confidence: 7, target: ch.perWeek, cue: '', action: '', free: false } };
    });
  }

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((d) => {
      const next = { ...d[id], ...p };
      // Editing the two-part form rebuilds the sentence.
      if (('cue' in p || 'action' in p) && !next.free) next.ifThen = joinIfThen(next.cue, next.action);
      return { ...d, [id]: next };
    });
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
      {carried.length > 0 && (
        <div className="card tip success">
          <small>
            <strong>Carried over from your reflection:</strong>{' '}
            {carried.map((c) => `${challengeById(c.challengeId)?.title ?? c.challengeId}${c.fromReflection ? ' (with your change)' : ''}`).join('; ')}.
            Repeating a useful action is fine; there's no need to switch to something new. Change or untick anything.
          </small>
        </div>
      )}
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
          goal={g}
          onFocus={(focus) =>
            update((s) => ({
              ...s,
              goals: s.goals.map((x) => (x.trait === g.trait && x.focus ? { ...x, focus: { ...x.focus, ...focus } } : x)),
            }))
          }
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
  goal: Goal;
  onFocus: (f: { barrier?: BarrierId; barrierNote?: string }) => void;
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
  const { goal, onFocus, trait, why, level, prevWeek, drafts, expanded, onExpand, onToggle, onPatch } = props;
  const barrier = barrierById(goal.focus?.barrier);
  const suggestions = useMemo(
    () => suggestChallenges(trait, level, CHALLENGES, prevWeek, barrier?.challenges),
    [trait, level, prevWeek, barrier],
  );
  // Always keep already-selected challenges visible even if they fall below the fold.
  const visible = expanded
    ? suggestions
    : suggestions.filter((c, i) => i < SHOW_INITIALLY || drafts[c.id]);

  return (
    <section style={{ margin: '24px 0 22px' }}>
      <h2 style={{ margin: 0 }}>{TRAITS[trait].goalName}</h2>
      {goal.focus ? (
        <p className="muted" style={{ margin: '2px 0 8px' }}>
          Working on: {goal.focus.problem}. You'll know it's better when: {goal.focus.better}
        </p>
      ) : (
        <p className="muted" style={{ margin: '2px 0 8px' }}>Why: {why}</p>
      )}
      {goal.focus && <BarrierPicker focus={goal.focus} onChange={onFocus} />}
      {trait === 'A' && (
        <p className="muted" style={{ fontSize: '0.88rem', margin: '0 0 10px' }}>
          {AGREEABLENESS_NOTE}
        </p>
      )}
      <span className="pill" style={{ marginBottom: 10 }}>
        Suggested level: {LEVEL_LABEL[level]}
      </span>
      <div className="stack">
        {visible.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            fitsBarrier={!!barrier?.challenges.includes(c.id)}
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

/** What usually gets in the way, with a small response matched to it. */
function BarrierPicker({
  focus,
  onChange,
}: {
  focus: NonNullable<Goal['focus']>;
  onChange: (f: { barrier?: BarrierId; barrierNote?: string }) => void;
}) {
  const current = barrierById(focus.barrier);
  return (
    <div className="card soft" style={{ margin: '4px 0 12px' }}>
      <strong>What usually gets in the way?</strong>
      <div className="chips" role="group" aria-label="What usually gets in the way?" style={{ margin: '8px 0' }}>
        {BARRIERS.map((b) => (
          <button
            key={b.id}
            className="chip"
            aria-pressed={focus.barrier === b.id}
            onClick={() => onChange({ barrier: focus.barrier === b.id ? undefined : b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      {focus.barrier === 'other' && (
        <label className="field">
          <span>In a few words</span>
          <input
            type="text"
            value={focus.barrierNote ?? ''}
            maxLength={120}
            onChange={(e) => onChange({ barrierNote: e.target.value })}
          />
        </label>
      )}
      {current ? (
        <small className="fine">
          <strong>Try this:</strong> {current.response} Challenges that fit are marked below. These pairings are
          CBT-informed suggestions; procrastination programs were tested as a whole, not piece by piece.
        </small>
      ) : (
        <small className="fine">Pick one and the planner will suggest challenges that fit it.</small>
      )}
      {current && <RefList ids={['rozental2018']} />}
    </div>
  );
}

function ChallengeCard({
  challenge: c,
  fitsBarrier,
  draft,
  onToggle,
  onPatch,
}: {
  challenge: Challenge;
  fitsBarrier: boolean;
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
            {fitsBarrier && <span className="pill fits">Fits your barrier</span>}
            {technique && <EvidencePill level={technique.evidence} technique />}
          </div>
          <h3 style={{ margin: '4px 0' }}>{c.title}</h3>
          <p style={{ margin: 0 }}>{c.instructions}</p>
          {technique && <small className="fine">Technique: {technique.name}</small>}
        </div>
      </label>

      {draft && (
        <div className="stack" style={{ marginTop: 14 }}>
          <PlanForm challenge={c} draft={draft} onPatch={onPatch} />
          <PlanCoach
            challenge={c}
            plan={draft.ifThen}
            onUse={(ifThen) => onPatch({ ifThen, coachDrafted: true, ...draftParts(ifThen) })}
          />
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
                self-rated traits. The 7/10 line is this app's rule of thumb, not a cut-off from research.
              </small>
              <RefList ids={['hudson2019']} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The if-then plan: a two-part cue and action form, or the whole sentence written freely. */
function PlanForm({ challenge: c, draft, onPatch }: { challenge: Challenge; draft: Draft; onPatch: (p: Partial<Draft>) => void }) {
  const example = splitIfThen(c.ifThenExample);
  const hint = planHint(draft.ifThen);
  return (
    <fieldset className="plan-form">
      <legend>Your if-then plan</legend>
      {draft.free ? (
        <label className="field">
          <span className="sr-only">Your if-then plan</span>
          <textarea value={draft.ifThen} onChange={(e) => onPatch({ ifThen: e.target.value })} placeholder={c.ifThenExample} />
        </label>
      ) : (
        <>
          <label className="field">
            <span>If or when… (a moment you're sure to meet)</span>
            <input
              type="text"
              value={draft.cue}
              onChange={(e) => onPatch({ cue: e.target.value })}
              placeholder={example?.cue ?? 'I close my laptop at the end of the day'}
            />
          </label>
          <label className="field">
            <span>…then I will (a small first step someone could see)</span>
            <input
              type="text"
              value={draft.action}
              onChange={(e) => onPatch({ action: e.target.value })}
              placeholder={example?.action ?? "write tomorrow's first task on a sticky note"}
            />
          </label>
          {draft.ifThen && <p className="ifthen">{highlightIfThen(draft.ifThen)}</p>}
        </>
      )}
      {hint ? (
        <small style={{ color: 'var(--warn)' }}>{hint}</small>
      ) : (
        <small>Example: {c.ifThenExample}</small>
      )}
      {/* Switch back to the form only when the sentence fits it, so nothing typed is lost. */}
      {(!draft.free || !draft.ifThen.trim() || splitIfThen(draft.ifThen)) && (
        <button
          type="button"
          className="link-btn"
          onClick={() => onPatch(draft.free ? { ...draftParts(draft.ifThen), free: false } : { free: true })}
        >
          {draft.free ? 'Use the two-part form' : 'Write it my own way'}
        </button>
      )}
      <details>
        <summary>Picture it (30 seconds)</summary>
        <small>
          Imagine the moment in your plan: where you'll be and what you'll notice. Then picture yourself doing the first
          step. If it feels unlikely, change the moment or make the step smaller.
        </small>
      </details>
    </fieldset>
  );
}
