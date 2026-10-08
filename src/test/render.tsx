import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { resetPlacementStore } from '@/state/placement-store';
import { resetPlanStore } from '@/state/plan-store';
import { resetViewStore } from '@/state/view-store';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';

/** The seeded plan and the design's opening view. */
export function resetStores(): void {
  localStorage.clear();
  resetPlanStore();
  resetViewStore();
  resetPlacementStore();
}

export function renderWorkspace(path = '/plans/042W-SGSIN') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/plans/:planId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}
