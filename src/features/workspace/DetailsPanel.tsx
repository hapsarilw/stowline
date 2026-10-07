import { Inspector } from '@/features/inspector/Inspector';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore, type RightTab } from '@/state/view-store';
import { CountBadge } from '@/ui/Badges';
import { IconButton } from '@/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';

/** The right panel: Inspector and Violations. Collapses to a 40 px rail (FR-07). */
export function DetailsPanel() {
  const violations = usePlanStore((s) => s.violations.length);
  const { rightOpen, rightTab } = useViewStore();
  const view = useViewStore.getState;

  if (!rightOpen) {
    return (
      <aside
        aria-label="Details"
        className="col-start-3 row-start-2 flex min-h-0 min-w-0 flex-col items-center gap-2.5 overflow-hidden border-l border-border bg-surface py-2"
      >
        <IconButton
          label="Expand details panel"
          className="border-border2 bg-raised"
          onClick={() => view().toggleRight()}
        >
          <IconChevronLeft />
        </IconButton>
        <span className="text-[12px] font-semibold text-text2 [writing-mode:vertical-rl]">
          Inspector
        </span>
        <span className="text-[12px] font-semibold text-err [writing-mode:vertical-rl]">
          Violations · {violations}
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Details"
      className="col-start-3 row-start-2 flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-surface"
    >
      <div className="flex flex-none items-stretch border-b border-border">
        <Tabs
          label="Details"
          variant="underline"
          idPrefix="details"
          value={rightTab}
          onChange={(id: RightTab) => view().setRightTab(id)}
          tabs={[
            { id: 'inspector', label: 'Inspector' },
            {
              id: 'violations',
              label: (
                <>
                  Violations{' '}
                  <CountBadge tone="err" label="violations">
                    {violations}
                  </CountBadge>
                </>
              ),
            },
          ]}
          className="flex-1"
        />
        <IconButton
          label="Collapse panel"
          size="sm"
          className="mr-2 self-center"
          onClick={() => view().toggleRight()}
        >
          <IconChevronRight strokeWidth={1.6} />
        </IconButton>
      </div>
      {rightTab === 'inspector' ? (
        <div
          role="tabpanel"
          id="details-panel-inspector"
          aria-labelledby="details-tab-inspector"
          className="flex min-h-0 flex-1 flex-col overflow-auto"
        >
          <Inspector />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="details-panel-violations"
          aria-labelledby="details-tab-violations"
          className="min-h-0 flex-1 overflow-auto px-4 py-6 text-[12.5px] text-text2"
        >
          <span className="font-semibold text-text">{violations} violations</span>
          <p className="mt-2 text-pretty">
            The violations list, with Show and Apply fix, is not built yet.
          </p>
        </div>
      )}
    </aside>
  );
}
