import { isApiError } from '@/api/errors';
import { api, request } from './api';
import { useViewStore } from './view-store';

/** Export an approved plan as a JSON file (FR-65). */
export async function exportPlanFile(id: string): Promise<void> {
  const r = await request(
    () => api.exportPlan(id),
    () => void exportPlanFile(id),
    (e) => isApiError(e) && e.status === 409,
  );
  const view = useViewStore.getState();
  if (!r.ok) {
    if (isApiError(r.error))
      view.showToast({ kind: 'err', title: "Can't export", message: r.error.message });
    return;
  }
  const url = URL.createObjectURL(new Blob([r.data.text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = r.data.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  view.showToast({
    kind: 'ok',
    title: 'Plan exported',
    message: `File downloaded: ${r.data.filename}`,
  });
}
