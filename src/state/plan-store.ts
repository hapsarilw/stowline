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

// The plan store holds the plan being edited. Every change goes through a command: it passes
// the placement check, has an inverse, and re-checks only the stacks it touched.

export type PlanHeader = Omit<Plan, 'placements' | 'shiftCount'>;

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
  history: HistoryEntry[];
  future: Command[];
  apply: (command: Command) => CommandResult;
  undo: () => boolean;
  redo: () => boolean;
  /** Replaces the violations with the result of a full validation. */
  setViolations: (violations: Violation[]) => void;
}

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

export function initialPlanStore(): Omit<PlanStore, 'apply' | 'undo' | 'redo' | 'setViolations'> {
  const { data, state } = createPlanData();
  return {
    ...data,
    ...derive(data, state, validateAll(state, data.ctx)),
    history: [],
    future: [],
  };
}

export const usePlanStore = create<PlanStore>()((set, get) => {
  const commit = (state: StowState, touched: string[], extra: Partial<PlanStore>) => {
    const s = get();
    const violations = revalidate(s.violations, state, s.ctx, touched);
    set({ ...derive(s, state, violations), ...extra });
  };
  return {
    ...initialPlanStore(),
    apply(command) {
      const s = get();
      const r = applyCommand(s.state, s.ctx, command);
      if (!r.ok) return r;
      commit(r.state, r.touched, {
        history: [...s.history, { command, inverse: r.inverse }],
        future: [],
      });
      return r;
    },
    undo() {
      const s = get();
      const entry = s.history[s.history.length - 1];
      if (!entry) return false;
      const r = applyCommand(s.state, s.ctx, entry.inverse, { check: false });
      if (!r.ok) return false;
      commit(r.state, r.touched, {
        history: s.history.slice(0, -1),
        future: [...s.future, entry.command],
      });
      return true;
    },
    redo() {
      const s = get();
      const command = s.future[s.future.length - 1];
      if (!command) return false;
      const r = applyCommand(s.state, s.ctx, command, { check: false });
      if (!r.ok) return false;
      commit(r.state, r.touched, {
        history: [...s.history, { command, inverse: r.inverse }],
        future: s.future.slice(0, -1),
      });
      return true;
    },
    setViolations(violations) {
      set({ violations, violationIndex: indexViolations(violations) });
    },
  };
});

/** Back to the seeded plan. For tests. */
export function resetPlanStore(): void {
  usePlanStore.setState(initialPlanStore());
}
