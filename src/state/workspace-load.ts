import { createStowContext, createStowState, type Command, type StowState } from '@/domain';
import { api } from './api';
import { usePlanStore } from './plan-store';
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

/** Loads a plan from the API into the plan store. Throws ApiError. */
export async function fetchPlanInto(planId: string): Promise<void> {
  const [detail, items] = await Promise.all([api.getPlan(planId), api.getLoadList(planId)]);
  const { vessel } = await api.getVessel(detail.vesselId);
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
  usePlanStore.getState().load({ header, ctx, loadList, base: stabilityBase }, state);
}

/**
 * Opens a plan in the workspace. Unsaved commands from an earlier visit are put back on top
 * (FR-61). Returns a message when some could not be applied.
 */
export async function openWorkspace(
  planId: string,
): Promise<{ restored: number; dropped: string[] }> {
  await fetchPlanInto(planId);
  resetViewStore();
  resetPlacementStore();
  const saved = readUnsaved(planId);
  if (!saved) return { restored: 0, dropped: [] };
  const { applied, dropped } = replay(saved.commands);
  // The history now holds what was restored; the base is the version on the server.
  return { restored: applied, dropped };
}

export const workspaceReady = () => useViewStore.getState();
