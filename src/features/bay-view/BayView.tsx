import { useMemo, useState, type KeyboardEvent } from 'react';
import { ALL_ROWS, pad, type Half } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { IconExpand } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import { Cell } from './Cell';
import {
  buildBayModel,
  defaultFocus,
  nextFocus,
  type BayModel,
  type CellMark,
  type CellModel,
  type TotalModel,
} from './model';

const LEGEND: { label: string; style: React.CSSProperties }[] = [
  { label: 'Empty', style: { border: '1px solid var(--border)' } },
  {
    label: 'Occupied',
    style: { background: 'var(--pod-nlrtm)', border: '1px solid rgba(11,18,32,.35)' },
  },
  {
    label: 'Selected',
    style: {
      background: 'var(--pod-nlrtm)',
      border: '1px solid rgba(11,18,32,.35)',
      boxShadow: '0 0 0 2px var(--text)',
    },
  },
  {
    label: 'Focus',
    style: {
      border: '1px solid var(--border)',
      outline: '2px solid var(--accent)',
      outlineOffset: 1,
    },
  },
  { label: 'Valid', style: { background: 'var(--okbg)', border: '1px solid var(--ok)' } },
  {
    label: 'Invalid',
    style: {
      border: '1px solid var(--err)',
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(255,93,93,0.42) 0 2px, transparent 2px 5px)',
    },
  },
  {
    label: 'Locked',
    style: {
      background: 'var(--pod-aejea)',
      border: '1px solid rgba(11,18,32,.35)',
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(11,18,32,0.30) 0 2px, transparent 2px 5px)',
    },
  },
  {
    label: 'Violation',
    style: {
      background: 'var(--pod-lkcmb)',
      border: '1px solid rgba(11,18,32,.35)',
      boxShadow: 'inset 0 0 0 2px #b3141b',
    },
  },
];

const HALVES: { id: Half; label: string; name: string }[] = [
  { id: 'both', label: '40ft', name: '40ft slots' },
  { id: 'fore', label: 'Fore 20ft', name: '20ft fore halves' },
  { id: 'aft', label: 'Aft 20ft', name: '20ft aft halves' },
];

const COLS = 'grid grid-cols-[30px_repeat(16,minmax(0,1fr))_30px]';

function TotalCell({ t }: { t: TotalModel }) {
  if (!t.exists) return <div aria-hidden="true" className="invisible" />;
  return (
    <div role="gridcell" title={t.title} className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          'text-center font-mono text-[10px]',
          t.over ? 'font-semibold text-err' : 'text-text2',
        )}
      >
        {t.weight}
      </span>
      <span className="h-[3px] overflow-hidden rounded-[1px] bg-track">
        <span
          className="block h-full"
          style={{
            width: `${t.percent.toFixed(1)}%`,
            background: t.over ? 'var(--err)' : t.caution ? 'var(--warn)' : 'var(--text3)',
          }}
        />
      </span>
    </div>
  );
}

function TotalsRow({
  totals,
  label,
  limit,
  gap,
  height,
}: {
  totals: TotalModel[];
  label: string;
  limit: number;
  gap: number;
  height: number;
}) {
  return (
    <div
      role="row"
      aria-label={label}
      className={cn(COLS, 'flex-none items-center')}
      style={{ gap, height }}
    >
      <span role="rowheader" className="font-mono text-[9.5px] text-text3">
        Σ t
      </span>
      {totals.map((t, i) => (
        <TotalCell key={ALL_ROWS[i]} t={t} />
      ))}
      <span aria-hidden="true" className="text-right font-mono text-[9.5px] text-text3">
        /{limit}
      </span>
    </div>
  );
}

function TierRow({
  tier,
  cells,
  big,
  gap,
  focusKey,
  onSelect,
}: {
  tier: number;
  cells: CellModel[];
  big: boolean;
  gap: number;
  focusKey: string | null;
  onSelect: (key: string) => void;
}) {
  const label = pad(tier);
  return (
    <div role="row" className={cn(COLS, 'min-h-0 flex-[1_1_0]')} style={{ gap }}>
      <span role="rowheader" className="self-center font-mono text-[10px] text-text3">
        {label}
      </span>
      {cells.map((c, i) => (
        <Cell
          key={ALL_ROWS[i]}
          cell={c}
          big={big}
          focused={c.key === focusKey}
          onSelect={onSelect}
        />
      ))}
      <span aria-hidden="true" className="self-center text-right font-mono text-[10px] text-text3">
        {label}
      </span>
    </div>
  );
}

export interface BayViewProps {
  /** Marks for target slots while a container is held. Added in M4. */
  marks?: ReadonlyMap<string, { mark: CellMark; reason?: string }>;
}

/** The cross section of one bay, looking forward: rows, tiers, hatch cover, stack totals. */
export function BayView({ marks }: BayViewProps) {
  const ctx = usePlanStore((s) => s.ctx);
  const state = usePlanStore((s) => s.state);
  const violations = usePlanStore((s) => s.violationIndex);
  const { bay, half, selected, focus, centerTab, announcement } = useViewStore();
  const view = useViewStore.getState;
  const [gridFocused, setGridFocused] = useState(false);

  const big = centerTab === 'bay';
  const split = centerTab === 'split';
  const gap = big ? 3 : 1;
  const focusKey = focus ?? defaultFocus(ctx, state, bay, half);

  const model: BayModel = useMemo(
    () => buildBayModel({ ctx, state, violations, bay, half, selected, marks }),
    [ctx, state, violations, bay, half, selected, marks],
  );

  const onSelect = (key: string) => {
    const cell = [...model.deck, ...model.hold].flatMap((t) => t.cells).find((c) => c.key === key);
    const target = cell?.box?.slot ?? cell?.halves?.find((h) => h)?.slot;
    view().setFocus(key, { announce: cell?.label });
    if (target) view().select(target);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (!d) return;
    e.preventDefault();
    const to = nextFocus(ctx, bay, half, focusKey, d[0]!, d[1]!);
    if (to) onSelect(to);
  };

  const flat = [...model.deck, ...model.hold].flatMap((t) => t.cells);
  const rowsLabel = `Bay ${pad(bay)} cross section, looking forward. Port on the left, starboard on the right.`;

  return (
    <section aria-label="Bay view" className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex min-h-[30px] flex-none flex-wrap items-center gap-3 border-b border-border px-2.5 text-[12px]">
        <span className="font-mono text-[12px] font-semibold">Bay {pad(bay)}</span>
        <span className="text-text2">Cross section · looking forward</span>
        <Tabs
          label="Slot length"
          tabs={HALVES.map((h) => ({ id: h.id, label: h.label, name: h.name }))}
          value={half}
          onChange={(id) => view().setHalf(id)}
        />
        <div className="flex-1" />
        {big ? (
          <div
            aria-label="Cell legend"
            role="group"
            className="flex flex-wrap items-center gap-2.5"
          >
            {LEGEND.map((l) => (
              <span
                key={l.label}
                className="inline-flex items-center gap-[5px] text-[11.5px] text-text2"
              >
                <span
                  aria-hidden="true"
                  className="box-border h-[11px] w-4 rounded-[2px]"
                  style={l.style}
                />
                {l.label}
              </span>
            ))}
          </div>
        ) : null}
        {split ? (
          <button
            type="button"
            onClick={() => view().setCenterTab('bay')}
            className="flex h-6 cursor-pointer items-center gap-[5px] rounded-[3px] border border-border2 bg-raised px-2 text-[11.5px] text-text2 hover:text-text"
          >
            Full bay view
            <IconExpand size={11} />
          </button>
        ) : null}
      </div>

      <div
        role="grid"
        aria-label={rowsLabel}
        aria-activedescendant={
          flat.some((c) => c.key === focusKey && c.exists) ? `bay-cell-${focusKey}` : undefined
        }
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setGridFocused(true)}
        onBlur={() => setGridFocused(false)}
        className="relative flex min-h-0 flex-1 flex-col px-2.5 py-1.5 outline-none"
        style={{ gap }}
      >
        <div
          role="row"
          className={cn(COLS, 'h-3.5 flex-none items-end font-mono text-[10px] text-text3')}
          style={{ gap }}
        >
          <span aria-hidden="true" className="text-[9.5px] font-semibold text-text2">
            PORT
          </span>
          {ALL_ROWS.map((r) => (
            <span key={r} role="columnheader" className="text-center">
              {pad(r)}
            </span>
          ))}
          <span aria-hidden="true" className="text-right text-[9.5px] font-semibold text-text2">
            STBD
          </span>
        </div>
        {model.deck.map((t) => (
          <TierRow
            key={t.tier}
            tier={t.tier}
            cells={t.cells}
            big={big}
            gap={gap}
            focusKey={gridFocused ? focusKey : null}
            onSelect={onSelect}
          />
        ))}
        <TotalsRow
          totals={model.deckTotals}
          label="Deck stack weights"
          limit={90}
          gap={gap}
          height={big ? 24 : 16}
        />
        <div
          aria-hidden="true"
          className="grid h-2.5 flex-none grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-0.5"
        >
          <span className="font-mono text-[8.5px] tracking-[0.04em] text-text3">HATCH</span>
          <div className="h-0.5 bg-text3" />
          <span />
        </div>
        {model.hold.map((t) => (
          <TierRow
            key={t.tier}
            tier={t.tier}
            cells={t.cells}
            big={big}
            gap={gap}
            focusKey={gridFocused ? focusKey : null}
            onSelect={onSelect}
          />
        ))}
        <TotalsRow
          totals={model.holdTotals}
          label="Hold stack weights"
          limit={210}
          gap={gap}
          height={big ? 24 : 16}
        />
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex min-h-7 min-w-0 flex-none items-center gap-2.5 border-t border-border px-2.5 text-[12px] text-text2"
      >
        <span className="min-w-0 flex-1 truncate">
          {announcement || 'Bay grid: arrow keys move between slots.'}
        </span>
        <span className="flex flex-none gap-2.5 text-[11px] text-text3">
          <span className="flex items-center gap-1">
            <Kbd>←↑↓→</Kbd>Move
          </span>
        </span>
      </div>
    </section>
  );
}
