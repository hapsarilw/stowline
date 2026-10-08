import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { describeError } from '@/state/api';
import { useViewStore } from '@/state/view-store';
import { openWorkspace } from '@/state/workspace-load';
import { Button } from '@/ui/Button';
import { IconError } from '@/ui/icons';

/** Open plan (FR-04): loads the plan from the API, then shows the workspace at its own URL. */
export function PlanRoute() {
  const planId = useParams().planId ?? '';
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; planId: string } | { kind: 'error'; message: string }
  >({
    kind: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const { restored, dropped } = await openWorkspace(planId);
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
          message: `${restored} ${restored === 1 ? 'change' : 'changes'} from your last visit are back.`,
        });
    } catch (e) {
      setState({ kind: 'error', message: describeError(e) });
    }
  }, [planId]);

  useEffect(() => {
    // Fetch on mount, on a new plan id and on Retry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, attempt]);

  if (state.kind === 'ready') return <WorkspacePage />;
  if (state.kind === 'loading')
    return (
      <main className="grid h-full place-items-center" aria-busy="true">
        <p role="status" className="m-0 text-text2">
          Loading plan {planId}…
        </p>
      </main>
    );
  return (
    <main className="grid h-full place-items-center px-4">
      <div
        role="alert"
        className="flex max-w-[480px] flex-col gap-3 rounded border border-err bg-raised p-4"
      >
        <span className="flex items-center gap-2 font-semibold text-err">
          <IconError size={16} />
          Request failed
        </span>
        <span className="text-text2">{state.message}</span>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
          <Link
            to="/plans"
            className="inline-flex h-7 items-center rounded border border-border2 px-3 text-text no-underline"
          >
            All plans
          </Link>
        </div>
      </div>
    </main>
  );
}
