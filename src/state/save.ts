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
      message: `Plan ${id} · ${s.planned.toLocaleString('en-US')} of ${s.loadList.length.toLocaleString('en-US')} planned · version ${r.data.version}`,
    });
    view.announce(`Saved. Version ${r.data.version}.`);
    return 'saved';
  }
  const e = r.error;
  if (isApiError(e) && e.status === 409) {
    const d = e.details as unknown as ConflictDetails;
    useConflict.getState().setConflict({
      ...d,
      kept: usePlanStore.getState().history.map((h) => h.text),
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

/** Review changes, then put my changes on the newest version (FR-60). */
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
  view.showToast(
    dropped.length === 0
      ? {
          kind: 'ok',
          title: 'Your changes are on the newest version',
          message: `${plural(applied, 'change')} applied. Save to publish them.`,
        }
      : {
          kind: 'warn',
          title: `${plural(dropped.length, 'change')} could not be applied`,
          message: `${dropped[0]}. ${plural(applied, 'change')} applied. Save to publish them.`,
        },
  );
}
