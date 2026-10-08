import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fmt1, PODS, POD_LIST, slot40Key, type Container } from '@/domain';
import { beginDrag } from '@/features/workspace/drag';
import { heldContainer } from '@/state/placement';
import { pickFromList, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { IconButton } from '@/ui/Button';
import { Button } from '@/ui/Button';
import { PodBadge, PodSwatch } from '@/ui/Badges';
import { Chip, ChipSelect } from '@/ui/Chip';
import { IconChevronLeft, IconChevronRight, IconImport, IconReefer, IconSearch } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { cn } from '@/ui/cn';
import { sortBy, queryRows, toRows, TYPE_ORDER, type LoadRow, type SortKey } from './query';

const COLS = 'grid grid-cols-[16px_minmax(0,1fr)_34px_36px_44px_44px] items-center gap-1.5';
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 28;

export const SEARCH_ID = 'load-list-search';

const COLUMNS: { key: SortKey; label: string; align: 'start' | 'end' }[] = [
  { key: 'id', label: 'Container', align: 'start' },
  { key: 'type', label: 'Type', align: 'start' },
  { key: 'weight', label: 't', align: 'end' },
  { key: 'pod', label: 'POD', align: 'start' },
  { key: 'flags', label: 'Flags', align: 'end' },
];

function Checkbox({
  checked,
  id,
  onToggle,
}: {
  checked: boolean;
  id: string;
  onToggle: () => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select ${id}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        // The box is 14 px as designed. The invisible hit area around it is 24 px (NFR-13).
        'relative grid size-3.5 cursor-pointer place-items-center rounded-[3px] border text-onaccent before:absolute before:-inset-[6px] before:content-[""]',
        checked ? 'border-accent bg-accent' : 'border-border2',
      )}
    >
      {checked ? (
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      ) : null}
    </span>
  );
}

interface RowProps {
  row: LoadRow;
  index: number;
  start: number;
  checked: boolean;
  active: boolean;
  /** The container is in hand: dimmed with a dashed outline, as in screen 02. */
  held: boolean;
  onClick: () => void;
  onToggle: () => void;
}

function Row({ row, index, start, checked, active, held, onClick, onToggle }: RowProps) {
  const c = row.container;
  const planned = row.slot !== '';
  return (
    <div
      id={`ll-row-${index}`}
      role="row"
      aria-rowindex={index + 2}
      aria-selected={checked}
      data-held={held || undefined}
      onClick={onClick}
      onPointerDown={
        planned
          ? undefined
          : (e) => {
              // FR-31: a press on an unplanned row can become a drag to the bay view or the 3D view.
              if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
              beginDrag(e, { kind: 'list', containerId: c.id }, e.currentTarget);
            }
      }
      className={cn(
        COLS,
        'absolute top-0 left-0 box-border w-full cursor-pointer border-b border-border px-3 select-none hover:bg-hover',
        checked && 'bg-sel',
        held &&
          'bg-accentbg opacity-55 outline outline-1 -outline-offset-1 outline-accent outline-dashed',
        active && !held && 'outline outline-2 -outline-offset-2 outline-accent',
      )}
      style={{ height: ROW_HEIGHT, transform: `translateY(${start}px)` }}
    >
      <span role="gridcell">
        <Checkbox checked={checked} id={c.id} onToggle={onToggle} />
      </span>
      <span
        role="gridcell"
        className={cn('truncate font-mono text-[12px]', planned ? 'text-text2' : 'text-text')}
      >
        {c.id}
      </span>
      <span role="gridcell" className="font-mono text-[11.5px] text-text2">
        {c.type}
      </span>
      <span role="gridcell" className="text-right font-mono text-[12px]">
        {fmt1(c.weightT)}
      </span>
      <span role="gridcell" className="justify-self-start">
        <PodBadge pod={c.pod} />
      </span>
      <span role="gridcell" className="flex items-center justify-end gap-[3px] text-text2">
        {planned ? (
          <span title="Planned slot" className="font-mono text-[10.5px] text-text3">
            {row.slot}
          </span>
        ) : null}
        {c.type === 'RF' ? (
          <span title={reeferTitle(c)} role="img" aria-label="Reefer" className="grid text-accent">
            <IconReefer size={13} />
          </span>
        ) : null}
        {c.imdgClass ? (
          <span
            title={`IMDG class ${c.imdgClass}`}
            role="img"
            aria-label={`Dangerous goods class ${c.imdgClass}`}
            className="inline-flex h-4 items-center gap-0.5 rounded-[2px] border border-warn px-[3px] font-mono text-[10px] font-semibold text-warn"
          >
            <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
              <path d="M4 0 8 4 4 8 0 4Z" fill="currentColor" />
            </svg>
            {c.imdgClass}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function reeferTitle(c: Container): string {
  const t = c.reeferSetPointC;
  return t === undefined ? 'Reefer' : `Reefer ${t < 0 ? '−' : '+'}${Math.abs(t).toFixed(1)} °C`;
}

/** The containers to load at this port call: search, filter, sort, select, and pick for placement. */
export function LoadList() {
  const loadList = usePlanStore((s) => s.loadList);
  const slotOf = usePlanStore((s) => s.state.slotOf);
  const planned = usePlanStore((s) => s.planned);
  const { leftOpen, query, checked } = useViewStore();
  const heldId = usePlacementStore((s) => heldContainer(s.placement));
  const listHeld = usePlacementStore(
    (s) =>
      (s.placement.kind === 'holding' || s.placement.kind === 'over') &&
      s.placement.source.kind === 'list',
  );
  const view = useViewStore.getState;

  const all = useMemo(() => toRows(loadList, slotOf), [loadList, slotOf]);
  const rows = useMemo(() => queryRows(all, query), [all, query]);

  const scroller = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // TanStack Virtual returns functions that are not memoizable. This app does not use the React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
  });

  const activeIndex = Math.max(
    0,
    rows.findIndex((r) => r.container.id === activeId),
  );
  const unplanned = loadList.length - planned;

  const chosen = loadList.filter((c) => checked[c.id]);
  const chosenWeight = chosen.reduce((a, c) => a + c.weightT, 0);

  const activate = (row: LoadRow) => {
    if (row.slot) {
      const bay = +slot40Key(row.slot).slice(0, 2);
      view().select(row.slot, { bay });
    } else view().toggleChecked(row.container.id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (rows.length === 0) return;
    let next = activeIndex;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, activeIndex + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, activeIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'PageDown') next = Math.min(rows.length - 1, activeIndex + 10);
    else if (e.key === 'PageUp') next = Math.max(0, activeIndex - 10);
    else if (e.key === ' ') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) activate(row);
      return;
    } else if (e.key === 'Enter') {
      // FR-17: Enter picks up the row and the keyboard goes on in the bay grid.
      e.preventDefault();
      const row = rows[activeIndex];
      if (!row) return;
      setActiveId(row.container.id);
      if (row.slot) activate(row);
      else pickFromList(row.container.id, 'keyboard');
      return;
    } else return;
    e.preventDefault();
    setActiveId(rows[next]!.container.id);
    virt.scrollToIndex(next);
  };

  if (!leftOpen) {
    return (
      <aside
        aria-label="Load list"
        className="row-start-2 col-start-1 flex min-h-0 min-w-0 flex-col items-center gap-2.5 overflow-hidden border-r border-border bg-surface py-2"
      >
        <IconButton
          label="Expand load list"
          className="border-border2 bg-raised"
          onClick={() => view().toggleLeft()}
        >
          <IconChevronRight />
        </IconButton>
        <span className="text-[12px] font-semibold text-text2 [writing-mode:vertical-rl] rotate-180">
          Load list · <span className="font-mono">{unplanned.toLocaleString('en-US')}</span>{' '}
          unplanned
        </span>
      </aside>
    );
  }

  const pods = POD_LIST.map((code) => ({
    value: code,
    label: PODS[code].short,
    swatch: <PodSwatch pod={code} />,
  }));
  const types = TYPE_ORDER.map((t) => ({ value: t, label: t }));

  return (
    <aside
      aria-label="Load list"
      className="row-start-2 col-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-surface"
    >
      <div className="flex h-10 flex-none items-center gap-2 pr-2 pl-3">
        <h2 className="m-0 text-[13px] font-semibold">Load list</h2>
        <span className="font-mono text-[11px] text-text2">
          SGSIN · {loadList.length.toLocaleString('en-US')}
        </span>
        <div className="flex-1" />
        <IconButton label="Import load list" size="sm" disabled>
          <IconImport />
        </IconButton>
        <IconButton label="Collapse load list" size="sm" onClick={() => view().toggleLeft()}>
          <IconChevronLeft />
        </IconButton>
      </div>
      <div className="flex-none px-3">
        <label className="flex h-7 items-center gap-1.5 rounded border border-border2 bg-bg pr-1.5 pl-2">
          <span className="text-text3">
            <IconSearch size={13} strokeWidth={1.6} />
          </span>
          <input
            id={SEARCH_ID}
            aria-label="Search load list"
            placeholder="Search ID, POD, type"
            value={query.q}
            onChange={(e) => view().setQuery({ q: e.target.value })}
            className="h-6 min-w-0 flex-1 border-0 bg-transparent text-[12.5px] outline-0 placeholder:text-text3"
          />
          <Kbd>/</Kbd>
        </label>
      </div>
      <div role="group" aria-label="Filters" className="flex flex-none flex-wrap gap-1 px-3 py-2">
        <ChipSelect
          label="POD"
          value={query.pod}
          options={pods}
          onChange={(pod) => view().setQuery({ pod })}
        />
        <ChipSelect
          label="Type"
          value={query.type}
          options={types}
          onChange={(type) => view().setQuery({ type })}
        />
        <Chip pressed={query.reefer} onClick={() => view().setQuery({ reefer: !query.reefer })}>
          Reefer
        </Chip>
        <Chip pressed={query.dg} onClick={() => view().setQuery({ dg: !query.dg })}>
          DG
        </Chip>
        <Chip
          pressed={query.unplannedOnly}
          onClick={() => view().setQuery({ unplannedOnly: !query.unplannedOnly })}
        >
          Unplanned only
        </Chip>
      </div>

      <div
        ref={scroller}
        role="grid"
        aria-label="Containers to load"
        aria-multiselectable="true"
        aria-rowcount={rows.length + 1}
        aria-activedescendant={rows.length > 0 ? `ll-row-${activeIndex}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          'min-h-0 overflow-auto outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          rows.length > 0 ? 'flex-1' : 'flex-none',
        )}
      >
        <div role="rowgroup" className="sticky top-0 z-[2] bg-surface">
          <div
            role="row"
            aria-rowindex={1}
            className={cn(COLS, 'h-7 border-y border-border px-3 text-[11px]')}
          >
            <span role="columnheader" className="size-3 rounded-[3px] border border-border2">
              <span className="sr-only">Selected</span>
            </span>
            {COLUMNS.map((col) => (
              <span
                key={col.key}
                role="columnheader"
                aria-sort={
                  query.sortKey === col.key
                    ? query.sortDir === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className={cn(
                  'flex min-w-0',
                  col.align === 'end' ? 'justify-end' : 'justify-start',
                )}
              >
                <button
                  type="button"
                  onClick={() => view().setQuery(sortBy(query, col.key))}
                  className={cn(
                    'flex min-h-6 min-w-6 cursor-pointer items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-[11px] font-medium',
                    query.sortKey === col.key ? 'text-text' : 'text-text2',
                  )}
                >
                  {col.label}
                  <span aria-hidden="true" className="text-[8px]">
                    {query.sortKey === col.key ? (query.sortDir === 1 ? '▲' : '▼') : ''}
                  </span>
                </button>
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="relative w-full" style={{ height: virt.getTotalSize() }}>
          {virt.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <Row
                key={row.container.id}
                row={row}
                index={item.index}
                start={item.start - HEADER_HEIGHT}
                checked={!!checked[row.container.id]}
                active={item.index === activeIndex && activeId !== null}
                held={row.container.id === heldId && listHeld}
                onClick={() => {
                  setActiveId(row.container.id);
                  activate(row);
                }}
                onToggle={() => view().toggleChecked(row.container.id)}
              />
            );
          })}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-start gap-2 px-4 py-6 text-[12.5px] text-text2">
          <span className="font-semibold text-text">No containers match</span>
          <span className="text-pretty">
            Nothing in the SGSIN load list matches “{query.q}” with the current filters.
          </span>
          <Button
            className="h-[26px] px-2.5 text-[12px] font-normal"
            onClick={() =>
              view().setQuery({ q: '', pod: null, type: null, reefer: false, dg: false })
            }
          >
            Clear search and filters
          </Button>
        </div>
      ) : null}

      <div
        data-testid="load-list-footer"
        className="flex h-9 flex-none items-center gap-2 border-t border-border px-3 text-[12px] text-text2"
      >
        <span className="whitespace-nowrap">
          <span className="font-semibold text-text">{chosen.length}</span> selected ·{' '}
          <span className="font-mono">{fmt1(chosenWeight)} t</span>
        </span>
        <div className="flex-1" />
        <span className="truncate font-mono text-[11px] whitespace-nowrap">
          {rows.length.toLocaleString('en-US')} shown · {unplanned.toLocaleString('en-US')}{' '}
          unplanned
        </span>
      </div>
      <span className="sr-only" role="status">
        {rows.length} containers shown
      </span>
    </aside>
  );
}
