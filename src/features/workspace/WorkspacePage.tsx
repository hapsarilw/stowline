import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { BayView } from '@/features/bay-view/BayView';
import { LoadList, SEARCH_ID } from '@/features/load-list/LoadList';
import { StabilityStrip } from '@/features/stability/StabilityStrip';
import { Viewport3D } from '@/features/viewport3d/Viewport3D';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { BayNavigator } from './BayNavigator';
import { CenterToolbar } from './CenterToolbar';
import { DetailsPanel } from './DetailsPanel';
import { SplitHandle } from './SplitHandle';
import { ToastHost } from './ToastHost';
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
      className="relative col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col"
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
  const { leftOpen, rightOpen, announcement } = useViewStore();

  useEffect(() => {
    document.title = `${header.voyage} ${header.port} · Stowline`;
  }, [header]);

  // Undo and redo work from anywhere on the page, except while typing in a field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== 'z' ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA'
      )
        return;
      e.preventDefault();
      const plan = usePlanStore.getState();
      if (e.shiftKey) plan.redo();
      else plan.undo();
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

  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (e.key === '/' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT') {
      e.preventDefault();
      useViewStore.getState().setLeftOpen(true);
      requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative grid h-full min-h-[640px] grid-rows-[48px_minmax(0,1fr)_64px] overflow-hidden bg-bg"
      style={{
        gridTemplateColumns: `${leftOpen ? '320px' : '40px'} minmax(0,1fr) ${rightOpen ? '320px' : '40px'}`,
      }}
    >
      <TopBar />
      <LoadList />
      <Center />
      <DetailsPanel />
      <footer className="col-span-full row-start-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] border-t border-border bg-surface">
        <BayNavigator />
        <StabilityStrip />
      </footer>
      <ToastHost />
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
