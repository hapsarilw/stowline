import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ALL_ROWS, fmtTenths, isTop, pad, PODS, toTenths, type Half, type SlotKey } from '@/domain';
import { useStabilityPreview, signed } from '@/features/stability/preview';
import { beginDrag } from '@/features/workspace/drag';
import { heldContainer, marksFor, type PlacementState } from '@/state/placement';
import { dispatch, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { IconExpand } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import { Cell, type CellAnim, type CellGhost, type CellTip } from './Cell';
import {
  buildBayModel,
  defaultFocus,
  nextFocus,
  type BayModel,
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

/** What only one cell at a time shows: the tooltip, the held ghost, an animation. */
interface CellExtras {
  tipKey: SlotKey | null;
  tip: CellTip | null;
  ghost: CellGhost | null;
  anim: { key: SlotKey; anim: CellAnim } | null;
}

function TierRow({
  tier,
  cells,
  big,
  gap,
  focusKey,
  extras,
  onSelect,
  onPress,
}: {
  tier: number;
  cells: CellModel[];
  big: boolean;
  gap: number;
  focusKey: string | null;
  extras: CellExtras;
  onSelect: (key: string) => void;
  onPress: (key: string, e: React.PointerEvent<HTMLElement>) => void;
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
          tip={c.key === extras.tipKey ? extras.tip : null}
          ghost={c.key === focusKey ? extras.ghost : null}
          anim={c.key === extras.anim?.key ? extras.anim.anim : null}
          onSelect={onSelect}
          onPress={onPress}
        />
      ))}
      <span aria-hidden="true" className="self-center text-right font-mono text-[10px] text-text3">
        {label}
      </span>
    </div>
  );
}

/** The tooltip over the target under the pointer (FR-34), as mkCell in the design. */
function tipFor(p: PlacementState, preview: string): { key: SlotKey; tip: CellTip } | null {
  if (p.kind !== 'over' || p.via !== 'pointer' || !p.check.target) return null;
  const c = p.check;
  const stack = `Valid · stack ${fmtTenths(toTenths(c.stackWeightT))} t of ${fmtTenths(toTenths(c.limitT))} t`;
  const tip: CellTip = !c.valid
    ? {
        tone: 'error',
        title: c.reason ?? 'Not a valid slot',
        detail: `Drop disabled at ${p.target}`,
      }
    : {
        tone: c.warnings.length ? 'warning' : 'ok',
        title: c.warnings[0]?.message ?? stack,
        detail: `Drop to place at ${p.target}${preview ? ` · ${preview}` : ''}`,
      };
  return { key: p.target, tip };
}

/** The cross section of one bay, looking forward: rows, tiers, hatch cover, stack totals. */
export function BayView() {
  const ctx = usePlanStore((s) => s.ctx);
  const state = usePlanStore((s) => s.state);
  const violations = usePlanStore((s) => s.violationIndex);
  const { bay, half, selected, focus, centerTab, announcement, gridFocusSeq } = useViewStore();
  const { placement, shake, settle, pickedAt } = usePlacementStore();
  const preview = useStabilityPreview();
  const view = useViewStore.getState;
  const [gridFocused, setGridFocused] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

  const big = centerTab === 'bay';
  const split = centerTab === 'split';
  const gap = big ? 3 : 1;
  const focusKey = focus ?? defaultFocus(ctx, state, bay, half);
  const heldId = heldContainer(placement);
  const keyboardHeld =
    heldId !== null &&
    placement.kind !== 'swapping' &&
    placement.kind !== 'idle' &&
    placement.via === 'keyboard';

  const marks = useMemo(
    () => marksFor(placement, { state, ctx, bay }),
    [placement, state, ctx, bay],
  );
  const model: BayModel = useMemo(
    () => buildBayModel({ ctx, state, violations, bay, half, selected, marks }),
    [ctx, state, violations, bay, half, selected, marks],
  );

  const extras: CellExtras = useMemo(() => {
    const t = tipFor(placement, preview ? `Trim ${signed(preview.trim)} m` : '');
    const held = heldId ? ctx.containers.get(heldId) : undefined;
    const ghost: CellGhost | null =
      keyboardHeld && held && !state.placements.has(focusKey)
        ? {
            pod: held.pod,
            short: PODS[held.pod as keyof typeof PODS]?.short ?? held.pod,
            last4: held.id.slice(-6, -2),
          }
        : null;
    // The newer of the two animations wins.
    const a =
      shake && (!settle || shake.seq > settle.seq)
        ? { key: shake.key, anim: { kind: 'shake' as const, seq: shake.seq } }
        : settle
          ? { key: settle.key, anim: { kind: 'settle' as const, seq: settle.seq } }
          : null;
    return { tipKey: t?.key ?? null, tip: t?.tip ?? null, ghost, anim: a };
  }, [placement, preview, heldId, keyboardHeld, ctx, state, focusKey, shake, settle]);

  // FR-17: a keyboard pick-up in the load list moves the focus here.
  useEffect(() => {
    if (gridFocusSeq > 0) grid.current?.focus();
  }, [gridFocusSeq]);

  // NFR-02: time from the pick-up to the frame that shows the marks. Two frames: the first runs
  // before the paint, the second after it, so this errs long.
  const measured = useRef<number | null>(null);
  useEffect(() => {
    if (pickedAt === null || measured.current === pickedAt || marks.size === 0) return;
    measured.current = pickedAt;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        performance.measure('nfr-02 target marks', { start: pickedAt, end: performance.now() });
      }),
    );
  }, [pickedAt, marks]);

  const cells = () => [...model.deck, ...model.hold].flatMap((t) => t.cells);

  const onSelect = (key: string) => {
    const p = usePlacementStore.getState().placement;
    // A click while a container is in hand places it; while swapping, it picks the other one.
    if (p.kind === 'holding' || p.kind === 'over') {
      view().setFocus(key);
      dispatch({ type: 'drop', key });
      return;
    }
    if (p.kind === 'swapping') {
      const cell = cells().find((c) => c.key === key);
      dispatch({ type: 'chooseSwap', key: cell?.box?.slot ?? key });
      return;
    }
    const cell = cells().find((c) => c.key === key);
    const target = cell?.box?.slot ?? cell?.halves?.find((h) => h)?.slot;
    view().setFocus(key, { announce: cell?.label });
    if (target) view().select(target);
  };

  // FR-33: the top container of a stack can be dragged to another slot.
  const onPress = (key: string, e: React.PointerEvent<HTMLElement>) => {
    const cell = cells().find((c) => c.key === key);
    const box = cell?.box;
    if (!box || box.locked || !isTop(state, ctx, box.slot)) return;
    beginDrag(e, { kind: 'slot', key: box.slot }, e.currentTarget);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const p = usePlacementStore.getState().placement;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (p.kind === 'idle') {
        const cell = cells().find((c) => c.key === focusKey);
        dispatch({ type: 'pickFromSlot', key: cell?.box?.slot ?? focusKey, via: 'keyboard' });
      } else if (p.kind === 'swapping') {
        const cell = cells().find((c) => c.key === focusKey);
        dispatch({ type: 'chooseSwap', key: cell?.box?.slot ?? focusKey });
      } else dispatch({ type: 'drop', key: focusKey });
      return;
    }
    if (e.key === 'Escape') {
      if (p.kind === 'idle') return;
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: 'cancel' });
      return;
    }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (!d) return;
    e.preventDefault();
    const to = nextFocus(ctx, bay, half, focusKey, d[0]!, d[1]!);
    if (!to) return;
    // While holding, the focus moves without changing the selection, and the slot is checked.
    if (p.kind === 'holding' || p.kind === 'over') {
      view().setFocus(to);
      dispatch({ type: 'hover', key: to });
    } else onSelect(to);
  };

  const flat = cells();
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
        ref={grid}
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
            focusKey={gridFocused || keyboardHeld ? focusKey : null}
            extras={extras}
            onSelect={onSelect}
            onPress={onPress}
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
            focusKey={gridFocused || keyboardHeld ? focusKey : null}
            extras={extras}
            onSelect={onSelect}
            onPress={onPress}
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
        {keyboardHeld ? (
          <span
            data-testid="held-pill"
            className="inline-flex h-[18px] flex-none items-center rounded-[3px] bg-accentbg px-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-text uppercase"
          >
            Picked up
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {announcement || 'Bay grid: arrow keys move between slots. Enter picks up a container.'}
        </span>
        <span className="flex flex-none gap-2.5 text-[11px] text-text3">
          <span className="flex items-center gap-1">
            <Kbd>←↑↓→</Kbd>Move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd>Pick up / place
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>Cancel
          </span>
        </span>
      </div>
    </section>
  );
}
