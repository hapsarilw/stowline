import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { BayView } from '@/features/bay-view/BayView';
import { LoadList, SEARCH_ID } from '@/features/load-list/LoadList';
import { StabilityDrawer } from '@/features/stability/StabilityDrawer';
import { StabilityStrip } from '@/features/stability/StabilityStrip';
import { Viewport3D } from '@/features/viewport3d/Viewport3D';
import { inspectorActions } from '@/features/inspector/Inspector';
import { dispatch, redoLast, undoLast, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { BayNavigator } from './BayNavigator';
import { ConflictBanner, ImportReportDialog } from './Dialogs';
import { CenterToolbar } from './CenterToolbar';
import { DetailsPanel } from './DetailsPanel';
import { SplitHandle } from './SplitHandle';
import { ToastHost } from './ToastHost';
import { ReadOnlyStrip } from './ReadOnlyStrip';
import { TopBar } from './TopBar';

function Center() {
  const { centerTab, splitRatio } = useViewStore();
  const area = useRef<HTMLDivElement>(null);
  const show3d = centerTab !== 'bay';
  const showBay = centerTab !== '3d';
  const split = centerTab === 'split';
  return (
    <main
      aria-label="Plan workspace"
      className="relative col-start-2 row-start-3 flex min-h-0 min-w-0 flex-col"
    >
      <CenterToolbar />
      <div ref={area} className="flex min-h-0 flex-1 flex-col">
        {/* Kept mounted when hidden, so the scene and the camera survive a tab switch. */}
        <div
          hidden={!show3d}
          className="flex min-h-0 flex-col"
          style={{ flex: split ? `${splitRatio} 1 0` : '1 1 0' }}
        >
          <Viewport3D />
        </div>
        {split ? <SplitHandle containerRef={area} /> : null}
        {showBay ? (
          <div
            className="flex min-h-0 flex-col"
            style={{ flex: split ? `${1 - splitRatio} 1 0` : '1 1 0' }}
          >
            <BayView />
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** The workspace: top bar, load list, center view, details, bay navigator, stability strip (FR-06). */
export function WorkspacePage() {
  const planId = useParams().planId;
  const header = usePlanStore((s) => s.header);
  const { leftOpen, rightOpen, announcement, centerTab } = useViewStore();

  useEffect(() => {
    document.title = `${header.voyage} ${header.port} · Stowline`;
  }, [header]);

  // Undo and redo work from anywhere on the page, except while typing in a field (FR-57).
  // "/" goes to the search. Esc puts back a container in hand. U, L and S run the Inspector
  // actions (FR-48).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (typing || e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoLast();
        else undoLast();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        useViewStore.getState().setLeftOpen(true);
        requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
        return;
      }
      // Esc, as the design's cancel: a container in hand, then a violation in focus, then the drawer.
      if (e.key === 'Escape') {
        const view = useViewStore.getState();
        if (usePlacementStore.getState().placement.kind !== 'idle') dispatch({ type: 'cancel' });
        else if (view.focusedViolation || view.highlight) view.clearViolationFocus();
        else if (view.drawerOpen) view.setDrawerOpen(false);
        else return;
        e.preventDefault();
        return;
      }
      const key = e.key.toUpperCase();
      if (key !== 'U' && key !== 'L' && key !== 'S') return;
      const action = inspectorActions().find((a) => a.shortcut === key);
      if (!action || action.disabled) return;
      e.preventDefault();
      action.run();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (planId !== header.id) {
    return (
      <main className="grid h-full place-items-center">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="m-0 text-[16px] font-semibold">Plan not found</h1>
          <p className="m-0 text-text2">There is no plan with the id {planId}.</p>
        </div>
      </main>
    );
  }

  return (
    <div
      className="relative grid h-full min-h-[640px] grid-rows-[48px_auto_minmax(0,1fr)_64px] overflow-hidden bg-bg"
      style={{
        gridTemplateColumns: `${leftOpen ? '320px' : '40px'} minmax(0,1fr) ${rightOpen ? '320px' : '40px'}`,
      }}
    >
      <TopBar />
      <ReadOnlyStrip />
      <LoadList />
      <Center />
      <DetailsPanel />
      <footer className="col-span-full row-start-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] border-t border-border bg-surface">
        <BayNavigator />
        <StabilityStrip />
      </footer>
      <ConflictBanner />
      <ImportReportDialog />
      <StabilityDrawer />
      <ToastHost />
      {/* The bay view has its own live region. This one speaks when the bay view is hidden. */}
      <div aria-live="polite" role="status" className="sr-only">
        {centerTab === '3d' ? announcement : ''}
      </div>
    </div>
  );
}
