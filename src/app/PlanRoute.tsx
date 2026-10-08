import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { isApiError } from '@/api/errors';
import { describeError } from '@/state/api';
import { useViewStore } from '@/state/view-store';
import { writeUnsaved } from '@/state/unsaved';
import { fetchPlan, showPlan } from '@/state/workspace-load';
import { preloadViewport } from '@/features/viewport3d/Viewport3D';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { IconError } from '@/ui/icons';
import { PageHeader } from './PageHeader';

/** Open plan (FR-04): loads the plan from the API, then shows the workspace at its own URL. */
export function PlanRoute() {
  const planId = useParams().planId ?? '';
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; planId: string }
    | { kind: 'error'; message: string; line: string }
  >({
    kind: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  // Design 14: on the failure page the focus starts on Retry.
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.kind === 'error') retryRef.current?.focus();
  }, [state.kind]);
  const reload = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  // Fetch on mount, on a new plan id and on Retry. Only the latest fetch is shown: in
  // development React runs this effect twice, and a stale load must not reset the view after the
  // person has started working.
  useEffect(() => {
    let current = true;
    preloadViewport();
    void (async () => {
      try {
        const loaded = await fetchPlan(planId);
        if (!current) return;
        const { restored, dropped } = showPlan(planId, loaded);
        setState({ kind: 'ready', planId });
        const view = useViewStore.getState();
        if (dropped.length)
          view.showToast({
            kind: 'warn',
            title: `${dropped.length} unsaved ${dropped.length === 1 ? 'change' : 'changes'} could not be restored`,
            message: `${dropped[0]}. ${restored} restored.`,
          });
        else if (restored)
          view.showToast({
            kind: 'info',
            title: 'Unsaved changes restored',
            message: `${restored} ${restored === 1 ? 'change' : 'changes'} from your last session ${restored === 1 ? 'is' : 'are'} back. Save to keep ${restored === 1 ? 'it' : 'them'}.`,
            action: {
              label: 'Discard',
              run: () => {
                writeUnsaved(planId, null);
                reload();
              },
            },
          });
      } catch (e) {
        if (current)
          setState({
            kind: 'error',
            message: describeError(e),
            line: isApiError(e) ? e.request : '',
          });
      }
    })();
    return () => {
      current = false;
    };
  }, [planId, attempt]);

  if (state.kind === 'ready') return <WorkspacePage />;
  const pulse = 'rounded-[3px] bg-raised motion-safe:animate-[stw-pulse_1.4s_ease-in-out_infinite]';
  if (state.kind === 'loading')
    return (
      <div className="flex h-full flex-col bg-bg text-text">
        <PageHeader planId={planId} />
        <div aria-busy="true" className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_320px]">
          <div
            aria-hidden="true"
            className="flex flex-col gap-2 border-r border-border bg-surface p-3"
          >
            <div className={cn(pulse, 'h-3.5 w-24')} />
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={cn(pulse, 'h-3.5')}
                style={{ width: `${70 + ((i * 17) % 30)}%` }}
              />
            ))}
          </div>
          <div
            role="status"
            className="grid place-content-center justify-items-center gap-3 text-center"
          >
            <span className="text-[12.5px]">
              Loading plan <span className="font-mono">{planId}</span>…
            </span>
            <div aria-hidden="true" className="h-0.5 w-40 overflow-hidden rounded-sm bg-track">
              <div className="h-full w-2/5 bg-accent motion-safe:animate-[stw-indet_1.2s_ease-in-out_infinite]" />
            </div>
            <span className="text-[12px] text-text2">Vessel geometry, containers, load list</span>
          </div>
          <div
            aria-hidden="true"
            className="flex flex-col gap-2 border-l border-border bg-surface p-3"
          >
            <div className={cn(pulse, 'h-3.5 w-20')} />
            <div className={cn(pulse, 'h-14')} />
            <div className={cn(pulse, 'h-3.5')} />
            <div className={cn(pulse, 'h-3.5 w-4/5')} />
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <PageHeader planId={planId} />
      <main className="grid min-h-0 flex-1 place-items-center px-4">
        <div role="alert" className="flex max-w-[420px] flex-col items-center gap-2 text-center">
          <span className="text-err">
            <IconError size={26} />
          </span>
          <h1 className="m-0 text-[16px] font-semibold">Request failed</h1>
          <p className="m-0 text-text2">{state.message}</p>
          {state.line ? (
            <span className="font-mono text-[11.5px] text-text3">{state.line}</span>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button ref={retryRef} variant="primary" onClick={reload}>
              Retry
            </Button>
            <Link
              to="/plans"
              className="inline-flex h-7 items-center rounded border border-border2 bg-raised px-3 text-text no-underline"
            >
              All plans
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
