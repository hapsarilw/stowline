import { plural, type PlanStatus } from '@/domain';
import { isApiError } from '@/api/errors';
import { api, request } from './api';
import { usePlanStore } from './plan-store';
import { saveCurrent, unsavedCommands } from './save';
import { useViewStore } from './view-store';

// Send for review, Approve, Return, Revise (FR-62, FR-63): the status changes on the server and
// the workspace follows it.

const LINES: Record<string, string> = {
  in_review: 'Sent for review',
  approved: 'Approved',
  draft: 'Returned to Draft',
};

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
  usePlanStore.getState().setStatus(r.data.status, r.data.version);
  const title = revising ? 'Revised' : (LINES[to] ?? 'Status changed');
  view.showToast({
    kind: 'ok',
    title,
    message: revising
      ? `Version ${r.data.version} is a new Draft`
      : `Plan ${r.data.id} is now ${r.data.status === 'in_review' ? 'in review' : r.data.status}`,
  });
  view.announce(`${title}. Plan ${r.data.id}.`);
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
