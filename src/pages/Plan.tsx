import { PlanCoach } from '../components/PlanCoach';
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { AppState, BarrierId, Challenge, Commitment, Goal, TraitId, WeekPlan } from '../types';
import { rankChallenges } from '../lib/personalize';
import { BARRIERS, barrierById } from '../data/barriers';
import { CHALLENGES, challengeById } from '../data/challenges';
import { AGREEABLENESS_NOTE, TRAITS } from '../data/traits';
import {
  currentWeekIndex,
  findWeek,
  previousPlannedWeek,
  isProgramComplete,
  recommendCount,
  recommendLevel,
  weekStart,
} from '../lib/program';
import { addDays, formatDate, today } from '../lib/dates';
import { joinIfThen, planHint, splitIfThen } from '../lib/plans';
import { highlightIfThen } from './Today';
import { revisePlan } from '../lib/actions';
import { RefList } from '../components/common';

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
      // The reflection's own wording wins over an accepted review suggestion.
      const apply = r?.applyTo === c.challengeId && !!r.nextTime.trim();
      const ifThen = apply ? r!.nextTime.trim() : (c.nextIfThen ?? c.ifThen);
      return { ...c, ifThen, target: c.nextTarget ?? c.target, fromReflection: apply || ifThen !== c.ifThen || c.nextTarget != null };
    });
}

const LEVEL_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Stretch (optional)' } as const;
const SHOW_INITIALLY = 3;

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

  function toggle(ch: Challenge, target = ch.perWeek) {
    setDrafts((d) => {
      if (d[ch.id]) {
        const { [ch.id]: _removed, ...rest } = d;
        return rest;
      }
      return { ...d, [ch.id]: { ifThen: '', confidence: 7, target, cue: '', action: '', free: false } };
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
        {formatDate(start)} – {formatDate(addDays(start, 6))}. Pick about {suggestedCount} per goal that you're sure
        you'll finish.
      </p>
      {carried.length > 0 && (
        <div className="card tip success">
          <p style={{ margin: 0 }}>
            <strong>Kept from last week:</strong>{' '}
            {carried.map((c) => `${challengeById(c.challengeId)?.title ?? c.challengeId}${c.fromReflection ? ' (with your change)' : ''}`).join('; ')}.
            Change or untick anything.
          </p>
        </div>
      )}
      {maintenance && (
        <div className="card tip">
          <p style={{ margin: 0 }}>
            <strong>The program is over.</strong> Keep one favourite challenge per goal going.
          </p>
          <details>
            <summary>Why?</summary>
            <p>Gains mostly held after programs ended, but they rarely grew without practice.</p>
            <RefList ids={['stieger2024']} />
          </details>
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
          state={state}
          weekIndex={idx}
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

      <details className="card soft">
        <summary>How this works</summary>
        <p>
          Deciding exactly <em>when</em> and <em>where</em> you'll act ("If it's 7:30 and I've poured my coffee, then
          I'll…") beats good intentions alone. A review of 94 tests found a medium-to-large effect.
        </p>
        <p>
          Finishing matters more than signing up. In one study of students, finishing challenges went with more growth
          in some traits; taking on more did not.
        </p>
        <RefList ids={['gollwitzer2006', 'hudson2019']} />
        <p>
          Suggestions learn from your log: challenges you do often move up, ones you skip move down, and new ones still
          get a turn. This runs on your device; nothing is sent anywhere.
        </p>
      </details>

      <div className="page-actions">
        <button className="primary" disabled={!valid} onClick={save}>
          {existing ? 'Update plan' : 'Commit to this week'}
        </button>
        {!valid && selectedIds.length > 0 && <p style={{ margin: 0 }}>Write a plan for each challenge.</p>}
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
  state: AppState;
  weekIndex: number;
  goal: Goal;
  onFocus: (f: { barrier?: BarrierId; barrierNote?: string }) => void;
  trait: TraitId;
  why: string;
  level: 1 | 2 | 3;
  prevWeek: ReturnType<typeof previousPlannedWeek>;
  drafts: Record<string, Draft>;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (c: Challenge, target?: number) => void;
  onPatch: (id: string, p: Partial<Draft>) => void;
}) {
  const { state, weekIndex, goal, onFocus, trait, why, level, drafts, expanded, onExpand, onToggle, onPatch } = props;
  const barrier = barrierById(goal.focus?.barrier);
  // Ranked from the person's own log (see lib/personalize.ts); stable within a week.
  const suggestions = useMemo(
    () => rankChallenges(state, { trait, library: CHALLENGES, level, fits: barrier?.challenges, seed: weekIndex }),
    [state, trait, level, barrier, weekIndex],
  );
  // Always keep already-selected challenges visible even if they fall below the fold.
  const visible = expanded
    ? suggestions
    : suggestions.filter((s, i) => i < SHOW_INITIALLY || drafts[s.challenge.id]);

  return (
    <section style={{ margin: '24px 0 22px' }}>
      <h2 style={{ margin: 0 }}>{TRAITS[trait].goalName}</h2>
      <p className="muted" style={{ margin: '2px 0 8px' }}>
        {goal.focus ? goal.focus.problem : why}
      </p>
      {goal.focus && <BarrierPicker focus={goal.focus} onChange={onFocus} />}
      {trait === 'A' && (
        <details style={{ margin: '0 0 8px' }}>
          <summary>Getting along isn't giving in</summary>
          <p style={{ marginTop: 0 }}>{AGREEABLENESS_NOTE}</p>
        </details>
      )}
      <span className="pill" style={{ marginBottom: 10 }}>
        Suggested level: {LEVEL_LABEL[level]}
      </span>
      <div className="stack">
        {visible.map(({ challenge: c, why: reason, target }) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            reason={reason}
            fitsBarrier={!!barrier?.challenges.includes(c.id)}
            draft={drafts[c.id]}
            onToggle={() => onToggle(c, target)}
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
        <>
          <p style={{ margin: '4px 0 0' }}>
            <strong>Try this:</strong> {current.response}
          </p>
          <details>
            <summary>Why?</summary>
            <p style={{ marginTop: 0 }}>
              Challenges that fit are marked below. The pairings come from CBT; programs for putting things off were
              tested as a whole, not piece by piece.
            </p>
            <RefList ids={['rozental2018']} />
          </details>
        </>
      ) : (
        <p style={{ margin: '4px 0 0' }}>Pick one to see challenges that fit.</p>
      )}
    </div>
  );
}

function ChallengeCard({
  challenge: c,
  reason,
  fitsBarrier,
  draft,
  onToggle,
  onPatch,
}: {
  challenge: Challenge;
  /** Why it's suggested, from the person's own record. */
  reason?: string;
  fitsBarrier: boolean;
  draft?: Draft;
  onToggle: () => void;
  onPatch: (p: Partial<Draft>) => void;
}) {
  // Show the first sentence; the rest of the how-to sits behind "How to do it".
  const split = /^(.+?(?<!\be\.g|\bi\.e)[.!?])\s+(\S[\s\S]*)$/.exec(c.instructions);
  const lead = split ? split[1] : c.instructions;
  const rest = split?.[2];
  return (
    <div className={`card pick-card ${draft ? 'selectable selected' : ''}`} style={{ marginBottom: 0 }}>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="checkbox" className="pick" checked={!!draft} onChange={onToggle} aria-label={`Select ${c.title}`} />
        <div>
          <h3 style={{ margin: '0 0 6px', paddingRight: 44 }}>{c.title}</h3>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span className="pill">{LEVEL_LABEL[c.level]}</span>
            <span className="pill">
              {c.perWeek}× / week · ~{c.minutes} min
            </span>
            {fitsBarrier && <span className="pill fits">Fits your barrier</span>}
          </div>
          <p style={{ margin: 0 }}>{lead}</p>
          {reason && <p className="suggest-why" style={{ marginBottom: 0 }}>{reason}</p>}
        </div>
      </label>
      {rest && (
        <details>
          <summary>How to do it</summary>
          <p style={{ marginTop: 0 }}>{rest}</p>
        </details>
      )}

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
                <span>How sure are you?</span>
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
              <p style={{ margin: 0 }}>Below 7/10? Make it smaller: fewer times, a shorter version or an easier one.</p>
              <details>
                <summary>Why?</summary>
                <p style={{ marginTop: 0 }}>
                  In one study, people who took on more challenges without finishing more fell slightly behind. The 7/10
                  line is this app's rule of thumb, not a research cut-off.
                </p>
                <RefList ids={['hudson2019']} />
              </details>
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
            <span>If or when… (a moment you'll surely hit)</span>
            <input
              type="text"
              value={draft.cue}
              onChange={(e) => onPatch({ cue: e.target.value })}
              placeholder={example?.cue ?? 'I close my laptop at the end of the day'}
            />
          </label>
          <label className="field">
            <span>…then I will (a small first step)</span>
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
      {hint && <p style={{ margin: 0, color: 'var(--warn)' }}>{hint}</p>}
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
        <p style={{ marginTop: 0 }}>
          Picture the moment and yourself doing the first step. If it feels unlikely, change the moment or shrink the
          step.
        </p>
      </details>
    </fieldset>
  );
}
