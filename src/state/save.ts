import { overlapsBySlot, plural, replayOnto, slotsOf, type Command } from '@/domain';
import { isApiError } from '@/api/errors';
import type { ConflictDetails } from '@/api/types';
import { api, request } from './api';
import { allowed } from './allowed';
import { usePlanStore, type Conflict } from './plan-store';
import { fetchPlan, replay } from './workspace-load';
import { useViewStore } from './view-store';

// Save with the base version, and the conflict flow (FR-59, FR-60, decision 6). The conflict
// lives in the plan store: the kept changes are the history, the server's are in the 409.

/** Opens or closes the review of a conflict (design 12). */
export function setReviewing(reviewing: boolean): void {
  const c = usePlanStore.getState().conflict;
  if (c) usePlanStore.getState().setConflict({ ...c, reviewing });
}

/** The server's commands since the kept changes' base version, in order. */
export const serverCommands = (c: Conflict): Command[] => c.changes.flatMap((v) => v.commands);

/**
 * The overlap check of the review (design 12): each kept change that touches a slot the
 * server's changes also touched, with those slots, and the slots the kept changes touch.
 */
export function reviewOf(c: Conflict, kept: readonly Command[]) {
  const theirs = serverCommands(c);
  return {
    overlaps: overlapsBySlot(kept, theirs),
    keptSlots: [...new Set(kept.flatMap(slotsOf))],
  };
}

export const unsavedCommands = (): Command[] =>
  usePlanStore.getState().history.map((h) => h.command);

export type SaveOutcome = 'saved' | 'conflict' | 'failed' | 'nothing';

export const when = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Save: the commands since the base version go to the server (FR-59). */
export async function saveCurrent(): Promise<SaveOutcome> {
  if (!allowed('save')) return 'failed';
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
    usePlanStore.getState().setConflict({
      baseVersion: plan.baseVersion,
      serverVersion: d.currentVersion,
      savedBy: d.savedBy,
      savedAt: d.savedAt,
      changes: d.changes ?? [],
      refused: null,
      reviewing: false,
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
 * Apply my changes to version N (design 12, decision 6). The kept changes are tried on the
 * server version first, with the rule check. When one is refused nothing is saved: the plan
 * here stays as it is, and the review names the change and the reason. Otherwise the server
 * version comes into the workspace, the kept changes go on it through the normal command path
 * (which re-checks the rules), and the result is saved on the new base version.
 */
export async function applyMyChanges(): Promise<'saved' | 'refused' | 'failed'> {
  const view = useViewStore.getState();
  const plan = usePlanStore.getState();
  const conflict = plan.conflict;
  if (!conflict || !allowed('save')) return 'failed';
  const kept = unsavedCommands();
  const r = await request(
    () => fetchPlan(plan.header.id),
    () => void applyMyChanges(),
  );
  if (!r.ok) return 'failed';
  const server = r.data.data.header.version;
  const dry = replayOnto(r.data.state, r.data.data.ctx, kept);
  if (!dry.ok) {
    usePlanStore.getState().setConflict({
      ...conflict,
      serverVersion: server,
      refused: { index: dry.index, reason: dry.reason },
      reviewing: true,
    });
    view.announce(
      `Nothing was saved. Change ${dry.index + 1} cannot go on version ${server}: ${dry.reason}.`,
    );
    return 'refused';
  }
  usePlanStore.getState().load(r.data.data, r.data.state);
  const { dropped } = replay(kept);
  if (dropped.length) return 'failed';
  return (await saveCurrent()) === 'saved' ? 'saved' : 'failed';
}
