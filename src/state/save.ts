import { create } from 'zustand';
import { plural, type Command } from '@/domain';
import { isApiError } from '@/api/errors';
import type { ConflictDetails } from '@/api/types';
import { api, request } from './api';
import { usePlanStore } from './plan-store';
import { fetchPlanInto, replay } from './workspace-load';
import { useViewStore } from './view-store';

// Save with the base version, and the conflict flow (FR-59, FR-60).

export interface Conflict extends ConflictDetails {
  /** The changes kept here: one line each. */
  kept: string[];
  /** The version these changes were made on. */
  madeOn: number;
}

interface ConflictStore {
  conflict: Conflict | null;
  reviewing: boolean;
  setConflict: (c: Conflict | null) => void;
  setReviewing: (on: boolean) => void;
}

export const useConflict = create<ConflictStore>()((set) => ({
  conflict: null,
  reviewing: false,
  setConflict: (conflict) => set({ conflict, reviewing: false }),
  setReviewing: (reviewing) => set({ reviewing }),
}));

export const unsavedCommands = (): Command[] =>
  usePlanStore.getState().history.map((h) => h.command);

export type SaveOutcome = 'saved' | 'conflict' | 'failed' | 'nothing';

export const when = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Save: the commands since the base version go to the server (FR-59). */
export async function saveCurrent(): Promise<SaveOutcome> {
  const plan = usePlanStore.getState();
  const commands = unsavedCommands();
  const view = useViewStore.getState();
  const id = plan.header.id;
  const r = await request(
    () => api.savePlan(id, { baseVersion: plan.baseVersion, commands }),
    () => void saveCurrent(),
    (e) => isApiError(e) && (e.status === 409 || e.status === 422),
  );
  if (r.ok) {
    usePlanStore.getState().markSaved(r.data.version);
    useConflict.getState().setConflict(null);
    const s = usePlanStore.getState();
    view.showToast({
      kind: 'ok',
      title: 'Draft saved',
      message: `${id} · version ${r.data.version} · ${s.planned.toLocaleString('en-US')} of ${s.loadList.length.toLocaleString('en-US')} planned`,
    });
    view.announce(`Saved. Version ${r.data.version}.`);
    return 'saved';
  }
  const e = r.error;
  if (isApiError(e) && e.status === 409) {
    const d = e.details as unknown as ConflictDetails;
    // One message at a time (design 16): the conflict alert replaces any toast.
    view.dismissToast();
    useConflict.getState().setConflict({
      ...d,
      kept: usePlanStore.getState().history.map((h) => h.text),
      madeOn: plan.baseVersion,
    });
    view.announce(`${e.message} Your ${plural(commands.length, 'change')} are kept.`);
    return 'conflict';
  }
  if (isApiError(e) && e.status === 422) {
    view.showToast({
      kind: 'err',
      title: "Can't save",
      message: `${e.message} Your changes are kept here.`,
    });
    return 'failed';
  }
  return 'failed';
}

/**
 * Apply my changes to version N (design 12): load the newest plan, put my changes on top with
 * the rule check, and save them. Nothing is saved when a change no longer fits: the ones that
 * do are applied, and a message says which did not.
 */
export async function rebaseOnServer(): Promise<void> {
  const view = useViewStore.getState();
  const id = usePlanStore.getState().header.id;
  const mine = unsavedCommands();
  const r = await request(
    () => fetchPlanInto(id),
    () => void rebaseOnServer(),
  );
  if (!r.ok) return;
  const { applied, dropped } = replay(mine);
  useConflict.getState().setConflict(null);
  if (dropped.length === 0) {
    await saveCurrent();
    return;
  }
  view.showToast({
    kind: 'warn',
    title: `${plural(dropped.length, 'change')} could not be applied`,
    message: `${dropped[0]}. ${plural(applied, 'change')} applied. Save to publish them.`,
  });
}
