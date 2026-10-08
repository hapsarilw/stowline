import { lazy, Suspense, useState } from 'react';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { Button } from '@/ui/Button';
import { IconError } from '@/ui/icons';
import { VIEWPORT_ATTR } from './bridge';
import { ErrorBoundary } from './ErrorBoundary';
import type { BenchSink } from './scene/Scene';
import { hasWebGL2 } from './webgl';

// The shell of the 3D view. It is small and loads with the workspace. three.js and the scene
// load on demand (FR-25 shows the skeleton meanwhile). Without WebGL 2, or when the scene fails,
// it offers the bay view, which has every action (FR-24, NFR-17).

const ViewportScene = lazy(() => import('./scene/ViewportScene'));

/** The loading skeleton from the components sheet. */
export function Skeleton() {
  const count = usePlanStore((s) => s.state.placements.size);
  const bars = [20, 34, 42, 42, 40, 64, 30, 16];
  return (
    <div
      aria-busy="true"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg"
    >
      <div aria-hidden="true" className="absolute top-2 left-2 flex gap-1.5">
        <span className="h-[30px] w-[220px] rounded border border-border bg-surface" />
        <span className="h-[30px] w-[230px] rounded border border-border bg-surface" />
      </div>
      <div
        aria-hidden="true"
        className="flex animate-pulse items-end gap-[3px] motion-reduce:animate-none"
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className={i === 5 ? 'w-3 bg-border' : 'w-[26px] bg-raised'}
            style={{ height: h }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="h-2 w-[300px] bg-raised [clip-path:polygon(4%_0,100%_0,97%_100%,0_100%)]"
      />
      <span role="status" className="text-[12px] text-text2">
        Loading vessel geometry and {count.toLocaleString('en-US')} containers…
      </span>
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-2 h-[26px] w-[280px] rounded border border-border bg-surface"
      />
    </div>
  );
}

/** FR-24: the message and the way to the bay view. */
export function Unavailable({ reason }: { reason: 'nowebgl' | 'error' }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-bg p-4">
      <div
        role="status"
        className="flex max-w-[460px] items-center gap-2.5 rounded border border-err bg-raised py-2 pr-2 pl-3"
      >
        <span className="grid text-err">
          <IconError size={16} />
        </span>
        <div className="flex flex-1 flex-col gap-px">
          <span className="text-[12.5px] font-semibold">3D view unavailable</span>
          <span className="text-[12px] text-text2">
            {reason === 'nowebgl' ? "WebGL couldn't start." : 'The 3D view stopped working.'} The
            bay grid still has every action.
          </span>
        </div>
        <Button
          className="h-[26px] bg-transparent px-2.5 text-[12px] font-normal"
          onClick={() => useViewStore.getState().setCenterTab('bay')}
        >
          Open bay view
        </Button>
      </div>
    </div>
  );
}

export function Viewport3D({ bench }: { bench?: BenchSink }) {
  const [failed, setFailed] = useState<'nowebgl' | 'error' | null>(() =>
    hasWebGL2() ? null : 'nowebgl',
  );
  return (
    <section
      aria-label="3D view"
      {...{ [VIEWPORT_ATTR]: '' }}
      className="relative min-h-0 flex-1 overflow-hidden bg-bg"
    >
      {failed ? (
        <Unavailable reason={failed} />
      ) : (
        <ErrorBoundary fallback={<Unavailable reason="error" />} onError={() => setFailed('error')}>
          <Suspense fallback={<Skeleton />}>
            <ViewportScene bench={bench} onLost={() => setFailed('error')} />
          </Suspense>
        </ErrorBoundary>
      )}
    </section>
  );
}
