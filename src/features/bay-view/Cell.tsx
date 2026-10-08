import { memo, useEffect, useRef } from 'react';
import { IconLock, IconPlug, IconReefer } from '@/ui/icons';
import { play, SETTLE, SHAKE } from '@/ui/motion';
import { TooltipCard, type TooltipTone } from '@/ui/TooltipCard';
import type { CellBox, CellMark, CellModel } from './model';

// One slot of the bay grid. Every state from the components sheet: empty, plug, occupied,
// selected, focused, valid, valid with warning, invalid, locked, has violation, picked-up origin.

const INK = '#0b1220'; // text on a POD color, as designed
const LOCKED_HATCH =
  'repeating-linear-gradient(135deg, rgba(11,18,32,0.30) 0 2px, transparent 2px 6px)';
const INVALID_HATCH =
  'repeating-linear-gradient(135deg, rgba(255,93,93,0.42) 0 2px, transparent 2px 6px)';

export interface CellTip {
  tone: TooltipTone;
  title: string;
  detail?: string;
}

/** The container held from the keyboard, drawn lifted over the focused empty cell. */
export interface CellGhost {
  pod: string;
  short: string;
  last4: string;
}

/** A one-off animation. A new seq plays it again. */
export interface CellAnim {
  kind: 'shake' | 'settle';
  seq: number;
}

interface CellProps {
  cell: CellModel;
  /** Full size shows ID digits and weight. Compact (Split) shows the POD code. */
  big: boolean;
  focused: boolean;
  tip?: CellTip | null;
  ghost?: CellGhost | null;
  anim?: CellAnim | null;
  onSelect?: (key: string) => void;
  /** A press that may become a drag (FR-33). */
  onPress?: (key: string, e: React.PointerEvent<HTMLElement>) => void;
}

function podColor(box: CellBox): string {
  const known = ['CMB', 'JEA', 'RTM', 'HAM'];
  const code = { CMB: 'lkcmb', JEA: 'aejea', RTM: 'nlrtm', HAM: 'deham' }[box.pod as 'CMB'];
  return known.includes(box.pod) && code ? `var(--pod-${code})` : 'var(--track)';
}

function styleOf(cell: CellModel, focused: boolean): React.CSSProperties {
  const { box, halves, mark, violation, selected } = cell;
  // The origin of a held container is drawn empty, with a dashed outline (mkCell: show = b && !origin).
  const show = (box !== null && mark !== 'origin') || halves !== null;
  const origin = mark === 'origin';
  const valid = mark === 'valid';
  const warn = mark === 'warning';
  const invalid = mark === 'invalid';
  const shadows = [
    selected && show ? '0 0 0 2px var(--text)' : '',
    show && violation ? `inset 0 0 0 2px ${violation === 'error' ? '#b3141b' : '#8a5a00'}` : '',
  ].filter(Boolean);
  return {
    backgroundColor:
      box && !origin
        ? podColor(box)
        : valid
          ? 'var(--okbg)'
          : warn
            ? 'var(--warnbg)'
            : 'transparent',
    backgroundImage: invalid ? INVALID_HATCH : box?.locked && !origin ? LOCKED_HATCH : 'none',
    border: invalid
      ? '1px solid var(--err)'
      : valid
        ? '1px solid var(--ok)'
        : warn
          ? '1px solid var(--warn)'
          : origin
            ? '1px dashed var(--accent)'
            : show
              ? '1px solid rgba(11,18,32,0.35)'
              : '1px solid var(--border)',
    boxShadow: shadows.join(', ') || 'none',
    outline: focused ? '2px solid var(--accent)' : 'none',
    outlineOffset: 1,
    color: show ? INK : 'var(--text3)',
    zIndex: focused || cell.mark ? 3 : 1,
  };
}

function Half({ box, big }: { box: CellBox | null; big: boolean }) {
  return (
    <span
      className="flex min-w-0 flex-1 flex-col items-center justify-center"
      style={{
        background: box ? podColor(box) : 'transparent',
        borderRight: '1px solid rgba(11,18,32,0.35)',
      }}
    >
      {box ? (
        <>
          <span className="text-[9.5px] font-semibold">{box.pod}</span>
          {big ? <span className="text-[9px]">{box.weight}</span> : null}
        </>
      ) : null}
    </span>
  );
}

function Ghost({ ghost }: { ghost: CellGhost }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    play(ref.current, SETTLE);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-testid="held-ghost"
      className="absolute -inset-px z-[3] flex translate-x-[-2px] translate-y-[-4px] flex-col items-center justify-center rounded-[2px] border border-text shadow-[0_4px_0_rgba(0,0,0,0.35)]"
      style={{ background: `var(--pod-${ghost.pod.toLowerCase()})`, color: INK }}
    >
      <span className="text-[11px] font-bold">{ghost.last4}</span>
      <span className="text-[9.5px] font-semibold">{ghost.short}</span>
    </div>
  );
}

function CellView({ cell, big, focused, tip, ghost, anim, onSelect, onPress }: CellProps) {
  const { halves, plug, violation, key } = cell;
  // The container lifted from its origin is not drawn there (mkCell: box = show ? b : null).
  const box = cell.mark === 'origin' ? null : cell.box;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (anim) play(ref.current, anim.kind === 'shake' ? SHAKE : SETTLE);
  }, [anim]);
  if (!cell.exists) {
    return <div aria-hidden="true" className="invisible" />;
  }
  const occupied = box !== null || halves !== null;
  return (
    <div
      ref={ref}
      id={`bay-cell-${key}`}
      data-slot={key}
      role="gridcell"
      aria-label={cell.label}
      aria-selected={cell.selected}
      data-state={[
        occupied ? 'occupied' : 'empty',
        cell.selected && occupied && 'selected',
        focused && 'focused',
        cell.mark,
        box?.locked && 'locked',
        occupied && violation && `violation-${violation}`,
        plug && 'plug',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect?.(key)}
      onPointerDown={onPress ? (e) => onPress(key, e) : undefined}
      className="relative box-border flex select-none min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-[2px] font-mono leading-[1.1]"
      style={styleOf(cell, focused)}
    >
      {halves ? (
        <span className="flex size-full">
          <Half box={halves[0]} big={big} />
          <Half box={halves[1]} big={big} />
        </span>
      ) : box ? (
        big ? (
          <>
            <span className="text-[11.5px] font-semibold">{box.last4}</span>
            <span className="text-[10px] font-medium">
              {box.pod} {box.weight}
            </span>
          </>
        ) : (
          <span className="text-[9.5px] font-semibold">{box.pod}</span>
        )
      ) : null}

      {big && box?.locked ? (
        <span aria-hidden="true" className="absolute top-0.5 left-0.5 grid">
          <IconLock size={9} />
        </span>
      ) : null}
      {big && plug && !box?.reefer ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 left-0.5 grid"
          style={{ color: box ? INK : 'var(--text3)' }}
        >
          <IconPlug size={9} />
        </span>
      ) : null}
      {big && box?.reefer ? (
        <span aria-hidden="true" className="absolute bottom-0.5 left-0.5 grid">
          <IconReefer size={9} strokeWidth={2} />
        </span>
      ) : null}
      {big && box?.dgClass ? (
        <span
          aria-hidden="true"
          className="absolute right-px bottom-px rounded-[1px] bg-[#0b1220] px-0.5 text-[8.5px] font-bold text-[#ffb020]"
        >
          {box.dgClass}
        </span>
      ) : null}
      {occupied && violation ? (
        <span
          aria-hidden="true"
          className="absolute -top-px -right-px grid size-[11px] place-items-center rounded-[0_2px_0_2px] text-[9px] font-bold"
          style={{ background: violation === 'error' ? '#ff5d5d' : '#ffb020', color: INK }}
        >
          !
        </span>
      ) : null}
      {ghost ? <Ghost ghost={ghost} /> : null}
      {tip ? (
        <TooltipCard
          tone={tip.tone}
          title={tip.title}
          detail={tip.detail}
          className="absolute bottom-[calc(100%+8px)] left-1/2 z-[6] -translate-x-1/2 font-sans whitespace-nowrap"
        />
      ) : null}
    </div>
  );
}

export const Cell = memo(CellView);
export type { CellMark };
