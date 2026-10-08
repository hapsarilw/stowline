import { plural, type PlanStatus } from '@/domain';
import { isApiError } from '@/api/errors';
import { api, request } from './api';
import { exportPlanFile } from './export';
import { currentSession } from './session-store';
import { usePlanStore } from './plan-store';
import { saveCurrent, unsavedCommands } from './save';
import { useViewStore } from './view-store';

// Send for review, Approve, Return, Revise (FR-62, FR-63): the status changes on the server and
// the workspace follows it.

/** The message after a status change (design 16). */
export function statusToast(
  to: PlanStatus,
  revising: boolean,
  version: number,
  planner: string | null,
  id: string,
): { title: string; message: string; action?: { label: string; run: () => void } } {
  if (revising) return { title: 'Revised', message: `Version ${version} is a new Draft` };
  if (to === 'in_review')
    return {
      title: 'Sent for review',
      message: `Version ${version} is with the senior planners. It is read only until it is returned or approved.`,
    };
  if (to === 'approved')
    return {
      title: 'Approved',
      message: `Version ${version} is approved and read only.`,
      action: { label: 'Export', run: () => void exportPlanFile(id) },
    };
  return {
    title: 'Returned to Draft',
    message: `Version ${version} is back with ${planner ?? 'the planner'}, with your comment.`,
  };
}

async function change(to: PlanStatus, comment?: string): Promise<boolean> {
  const plan = usePlanStore.getState();
  const view = useViewStore.getState();
  const revising = plan.header.status === 'approved';
  const r = await request(
    () => api.setStatus(plan.header.id, { to, comment }),
    () => void change(to, comment),
    (e) => isApiError(e) && [403, 409, 422].includes(e.status),
  );
  if (!r.ok) {
    const e = r.error;
    if (isApiError(e))
      view.showToast({ kind: 'err', title: "Can't change the status", message: e.message });
    return false;
  }
  const who = currentSession().user;
  usePlanStore
    .getState()
    .setStatus(r.data.status, r.data.version, { user: who, at: new Date().toISOString() });
  const toast = statusToast(
    to,
    revising,
    r.data.version,
    usePlanStore.getState().header.planner,
    r.data.id,
  );
  view.showToast({ kind: 'ok', ...toast });
  view.announce(`${toast.title}. ${toast.message}`);
  return true;
}

/** The server decides on what it has saved, so unsaved changes are saved first (step 9). */
async function savedFirst(): Promise<boolean> {
  if (unsavedCommands().length === 0) return true;
  return (await saveCurrent()) === 'saved';
}

export async function sendForReview(): Promise<boolean> {
  return (await savedFirst()) && change('in_review');
}
export async function approve(): Promise<boolean> {
  return (await savedFirst()) && change('approved');
}
export const returnToDraft = (comment: string) => change('draft', comment);
export const revise = () => change('draft');

export const describeUnsaved = () => {
  const n = unsavedCommands().length;
  return n === 0 ? 'No unsaved changes' : `${plural(n, 'unsaved change')}`;
};
