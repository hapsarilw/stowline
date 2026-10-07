import { pad, slot40Key } from '@/domain';
import { defaultFocus } from '@/features/bay-view/model';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore, type CenterTab } from '@/state/view-store';
import { IconButton } from '@/ui/Button';
import { IconChevronLeft, IconChevronRight, IconError } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';

const TABS = [
  { id: '3d', label: '3D' },
  { id: 'bay', label: 'Bay' },
  { id: 'split', label: 'Split' },
] as const;

/** View tabs, bay stepping and the facts of the bay on view (FR-08, FR-30). */
export function CenterToolbar() {
  const ctx = usePlanStore((s) => s.ctx);
  const state = usePlanStore((s) => s.state);
  const byBay = usePlanStore((s) => s.violationIndex.byBay);
  const { bay, half, centerTab } = useViewStore();
  const view = useViewStore.getState;
  const b = ctx.geometry.bayByNum(bay)!;

  const filled = new Set<string>();
  for (const k of state.placements.keys()) {
    const k40 = slot40Key(k);
    if (+k40.slice(0, 2) === bay) filled.add(k40);
  }
  const capacity = b.deckRows * b.deckTiers.length + b.holdRows * b.holdTiers.length;
  const inBay = byBay.get(bay) ?? 0;

  const step = (d: number) => {
    const next = ctx.vessel.bays[b.index + d];
    if (next) view().setBay(next.bay, defaultFocus(ctx, state, next.bay, half));
  };

  return (
    <div className="flex h-9 min-w-0 flex-none items-center gap-3 border-b border-border bg-surface px-2">
      <Tabs
        label="View"
        tabs={TABS}
        value={centerTab}
        onChange={(id: CenterTab) => view().setCenterTab(id)}
        className="flex-none"
      />
      <div className="flex flex-none items-center gap-0.5">
        <IconButton
          label="Previous bay"
          size="sm"
          disabled={b.index === 0}
          onClick={() => step(-1)}
        >
          <IconChevronLeft strokeWidth={1.6} />
        </IconButton>
        <span
          aria-live="polite"
          className="min-w-14 text-center font-mono text-[12.5px] font-semibold"
        >
          Bay {pad(bay)}
        </span>
        <IconButton
          label="Next bay"
          size="sm"
          disabled={b.index === ctx.vessel.bays.length - 1}
          onClick={() => step(1)}
        >
          <IconChevronRight strokeWidth={1.6} />
        </IconButton>
      </div>
      <span className="min-w-0 truncate text-[12px] whitespace-nowrap text-text2">
        40ft · bays {pad(bay - 1)} + {pad(bay + 1)} · {b.deckRows} rows deck, {b.holdRows} hold
      </span>
      <div className="flex-1" />
      {inBay > 0 ? (
        <span className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap text-err">
          <IconError size={13} />
          {inBay} in this bay
        </span>
      ) : null}
      <span className="font-mono text-[11.5px] whitespace-nowrap text-text2">
        {filled.size} / {capacity} slots
      </span>
    </div>
  );
}
