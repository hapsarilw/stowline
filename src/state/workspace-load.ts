import { createStowContext, createStowState, type Command, type StowState } from '@/domain';
import { api } from './api';
import { usePlanStore, type PlanData } from './plan-store';
import { readUnsaved } from './unsaved';
import { resetViewStore, useViewStore } from './view-store';
import { resetPlacementStore } from './placement-store';

// Open plan (FR-04): the plan, its load list and its vessel come from the API into the stores.

/** Replays commands on a plan, with the rule check. Returns what was applied and what was not. */
export function replay(commands: readonly Command[]): { applied: number; dropped: string[] } {
  let applied = 0;
  const dropped: string[] = [];
  for (const c of commands) {
    const r = usePlanStore.getState().apply(c);
    if (r.ok) applied++;
    else dropped.push(r.reason);
  }
  return { applied, dropped };
}

export interface LoadedPlan {
  data: PlanData;
  state: StowState;
}

/** Fetches a plan, its load list and its vessel. Touches no store. Throws ApiError. */
export async function fetchPlan(planId: string): Promise<LoadedPlan> {
  // The vessel needs only the plan: ask for it as soon as the plan arrives, while the load list
  // is still on its way (M7: about 220 ms less to open a plan).
  const planned = api.getPlan(planId);
  const [detail, items, { vessel }] = await Promise.all([
    planned,
    api.getLoadList(planId),
    planned.then((d) => api.getVessel(d.vesselId)),
  ]);
  const loadList = items.map((x) => x.container);
  const ctx = createStowContext({
    vessel,
    containers: [...detail.containers, ...loadList],
    placements: detail.placements,
  });
  const state: StowState = createStowState(detail.placements, detail.shiftCount);
  const {
    placements: _p,
    shiftCount: _s,
    containers: _c,
    stabilityBase,
    updatedAt: _u,
    updatedBy: _b,
    ...header
  } = detail;
  void [_p, _s, _c, _u, _b];
  return { data: { header, ctx, loadList, base: stabilityBase }, state };
}

/** Loads a plan from the API into the plan store, keeping the view as it is (a rebase). */
export async function fetchPlanInto(planId: string): Promise<void> {
  const { data, state } = await fetchPlan(planId);
  usePlanStore.getState().load(data, state);
}

/**
 * Puts a fetched plan in the workspace, with a fresh view. Unsaved commands from an earlier
 * visit are put back on top (FR-61). Returns how many came back, and why any did not.
 */
export function showPlan(
  planId: string,
  loaded: LoadedPlan,
): { restored: number; dropped: string[] } {
  usePlanStore.getState().load(loaded.data, loaded.state);
  resetViewStore();
  resetPlacementStore();
  const saved = readUnsaved(planId);
  if (!saved) return { restored: 0, dropped: [] };
  const { applied, dropped } = replay(saved.commands);
  return { restored: applied, dropped };
}

export const workspaceReady = () => useViewStore.getState();
