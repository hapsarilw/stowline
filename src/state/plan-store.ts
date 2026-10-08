import { create } from 'zustand';
import {
  applyCommand,
  calibrateStability,
  computeStability,
  createStowContext,
  createStowState,
  generateSampleCall,
  indexViolations,
  revalidate,
  toPlacements,
  validateAll,
  type CommandResult,
  type Command,
  type Container,
  type HistoryEntry,
  type Plan,
  type StabilityBase,
  type StabilityReading,
  type StowContext,
  type StowState,
  type Violation,
  type ViolationIndex,
} from '@/domain';
import { canEditPlan } from '@/domain';
import { activityText } from './messages';
import { useSessionStore } from './session-store';
import { writeUnsaved } from './unsaved';

// The plan store holds the plan being edited. Every change goes through a command: it passes
// the placement check, has an inverse, and re-checks only the stacks it touched.

export type PlanHeader = Omit<Plan, 'placements' | 'shiftCount'>;

/** A command in the history, with its line for the activity log. */
export interface HistoryItem extends HistoryEntry {
  text: string;
}

/** One entry of the plan's activity log (FR-58). */
export interface ActivityEntry {
  at: string;
  text: string;
}

export interface PlanData {
  header: PlanHeader;
  ctx: StowContext;
  /** Every container on the load list, in list order. */
  loadList: Container[];
  base: StabilityBase;
}

export interface PlanStore extends PlanData {
  state: StowState;
  violations: Violation[];
  violationIndex: ViolationIndex;
  stability: StabilityReading;
  /** Load list containers that are placed. */
  planned: number;
  history: HistoryItem[];
  future: Command[];
  /** Newest last. */
  activity: ActivityEntry[];
  /** When the whole plan was last checked (Date.now()): at load and on Validate. */
  checkedAt: number;
  /** The version on the server that the history starts from (FR-59). */
  baseVersion: number;
  apply: (command: Command) => CommandResult;
  undo: () => boolean;
  redo: () => boolean;
  /** Replaces the violations with the result of a full validation. */
  setViolations: (violations: Violation[]) => void;
  /** Replaces the whole plan, such as the benchmark vessel on /bench. Clears history. */
  load: (data: PlanData, state: StowState) => void;
  /** After a save: the history is what the server has now, and starts again from here. */
  markSaved: (version: number) => void;
  /** After a status change on the server. */
  setStatus: (status: PlanHeader['status'], version: number) => void;
  /** Adds containers to the load list, after an import (FR-64). */
  addToLoadList: (containers: Container[]) => void;
}

/** Whether this role can change this plan now: not when approved, not for a read only role. */
export const canEditNow = (status: PlanHeader['status']): boolean =>
  canEditPlan(useSessionStore.getState().role, status);

export const READ_ONLY_REASON = 'This plan is read only.';

export function createPlanData(): { data: PlanData; state: StowState } {
  const call = generateSampleCall();
  const loadList = call.loadList.map((x) => x.container);
  const ctx = createStowContext({
    vessel: call.vessel,
    containers: [...call.containers, ...loadList],
    placements: call.plan.placements,
  });
  const state = createStowState(call.plan.placements, call.plan.shiftCount);
  const { placements: _placements, shiftCount: _shiftCount, ...header } = call.plan;
  void _placements;
  void _shiftCount;
  return { data: { header, ctx, loadList, base: calibrateStability(state, ctx) }, state };
}

const countPlanned = (loadList: readonly Container[], state: StowState): number =>
  loadList.reduce((n, c) => n + (state.slotOf.has(c.id) ? 1 : 0), 0);

/** The store's values for a plan state. */
export function derive(data: PlanData, state: StowState, violations: Violation[]) {
  return {
    state,
    violations,
    violationIndex: indexViolations(violations),
    stability: computeStability(state, data.ctx, data.base),
    planned: countPlanned(data.loadList, state),
  };
}

export function initialPlanStore(): Omit<
  PlanStore,
  'apply' | 'undo' | 'redo' | 'setViolations' | 'load' | 'markSaved' | 'setStatus' | 'addToLoadList'
> {
  const { data, state } = createPlanData();
  return {
    ...data,
    ...derive(data, state, validateAll(state, data.ctx)),
    history: [],
    future: [],
    activity: [],
    checkedAt: Date.now(),
    baseVersion: data.header.version,
  };
}

const entry = (text: string): ActivityEntry => ({ at: new Date().toISOString(), text });

export const usePlanStore = create<PlanStore>()((set, get) => {
  const commit = (state: StowState, touched: string[], extra: Partial<PlanStore>) => {
    const s = get();
    const violations = revalidate(s.violations, state, s.ctx, touched);
    set({ ...derive(s, state, violations), ...extra });
    // Every change is kept in the browser, so a reload or a crash loses nothing (FR-61).
    const after = get();
    writeUnsaved(after.header.id, {
      baseVersion: after.baseVersion,
      commands: after.history.map((h) => h.command),
    });
  };
  return {
    ...initialPlanStore(),
    apply(command) {
      const s = get();
      if (!canEditNow(s.header.status)) return { ok: false, reason: READ_ONLY_REASON };
      const r = applyCommand(s.state, s.ctx, command);
      if (!r.ok) return r;
      const text = activityText(command, s.state);
      commit(r.state, r.touched, {
        history: [...s.history, { command, inverse: r.inverse, text }],
        future: [],
        activity: [...s.activity, entry(text)],
      });
      return r;
    },
    undo() {
      const s = get();
      if (!canEditNow(s.header.status)) return false;
      const last = s.history[s.history.length - 1];
      if (!last) return false;
      const r = applyCommand(s.state, s.ctx, last.inverse, { check: false });
      if (!r.ok) return false;
      commit(r.state, r.touched, {
        history: s.history.slice(0, -1),
        future: [...s.future, last.command],
        activity: [...s.activity, entry(`Undid: ${last.text}`)],
      });
      return true;
    },
    redo() {
      const s = get();
      if (!canEditNow(s.header.status)) return false;
      const command = s.future[s.future.length - 1];
      if (!command) return false;
      const r = applyCommand(s.state, s.ctx, command, { check: false });
      if (!r.ok) return false;
      const text = activityText(command, s.state);
      commit(r.state, r.touched, {
        history: [...s.history, { command, inverse: r.inverse, text }],
        future: s.future.slice(0, -1),
        activity: [...s.activity, entry(`Redid: ${text}`)],
      });
      return true;
    },
    setViolations(violations) {
      set({ violations, violationIndex: indexViolations(violations), checkedAt: Date.now() });
    },
    load(data, state) {
      set({
        ...data,
        ...derive(data, state, validateAll(state, data.ctx)),
        history: [],
        future: [],
        activity: [],
        checkedAt: Date.now(),
        baseVersion: data.header.version,
      });
    },
    markSaved(version) {
      const s = get();
      set({ header: { ...s.header, version }, baseVersion: version, history: [], future: [] });
      writeUnsaved(s.header.id, null);
    },
    setStatus(status, version) {
      const s = get();
      set({ header: { ...s.header, status, version } });
      if (s.history.length === 0) set({ baseVersion: version });
    },
    addToLoadList(containers) {
      const s = get();
      if (containers.length === 0) return;
      const ctx = createStowContext({
        vessel: s.ctx.vessel,
        containers: [...s.ctx.containers.values(), ...containers],
        placements: toPlacements(s.state),
      });
      set({ ctx, loadList: [...s.loadList, ...containers] });
    },
  };
});

/** Back to the seeded plan. For tests. */
export function resetPlanStore(): void {
  usePlanStore.setState(initialPlanStore());
}
