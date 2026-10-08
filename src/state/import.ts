import { create } from 'zustand';
import type { RejectedRow } from '@/domain';
import { isApiError } from '@/api/errors';
import { api, request } from './api';
import { allowed } from './allowed';
import { usePlanStore } from './plan-store';
import { useViewStore } from './view-store';

// Import load list (FR-64): the file goes to the server as text, which checks every row.

export interface ImportReport {
  fileName: string;
  accepted: number;
  rejected: RejectedRow[];
}

export const useImportReport = create<{ report: ImportReport | null; close: () => void }>()(
  (set) => ({
    report: null,
    close: () => set({ report: null }),
  }),
);

export async function importLoadListFile(file: File): Promise<void> {
  if (!allowed('import')) return;
  const view = useViewStore.getState();
  const id = usePlanStore.getState().header.id;
  const text = await file.text();
  const r = await request(
    () => api.importLoadList(id, text),
    () => void importLoadListFile(file),
    (e) => isApiError(e) && (e.status === 422 || e.status === 403),
  );
  if (!r.ok) {
    if (isApiError(r.error))
      view.showToast({ kind: 'err', title: "Can't import the file", message: r.error.message });
    return;
  }
  // The server holds the new rows; bring them into the load list.
  const list = await request(
    () => api.getLoadList(id),
    () => void importLoadListFile(file),
  );
  if (list.ok) {
    const fresh = list.data
      .map((x) => x.container)
      .filter((c) => !usePlanStore.getState().loadList.some((l) => l.id === c.id));
    usePlanStore.getState().addToLoadList(fresh);
  }
  useImportReport.setState({
    report: { fileName: file.name, accepted: r.data.accepted, rejected: r.data.rejected },
  });
  view.announce(
    `Import finished. ${r.data.accepted} accepted, ${r.data.rejected.length} rejected.`,
  );
}
