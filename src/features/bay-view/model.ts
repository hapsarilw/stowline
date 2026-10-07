import {
  ALL_ROWS,
  fmt1,
  fmtTenths,
  PODS,
  slot40Key,
  slotKeyFor,
  stackLimitTenths,
  stackWeightTenths,
  type Container,
  type Half,
  type Placement,
  type SlotKey,
  type StowContext,
  type StowState,
  type Violation,
  type ViolationIndex,
} from '@/domain';

// What the bay view draws, worked out from the plan. Pure, so the cell states can be tested
// without a browser.

export type CellMark = 'valid' | 'warning' | 'invalid' | 'origin';

export interface CellBox {
  id: string;
  /** Last 4 digits of the serial number, as printed in the cell. */
  last4: string;
  pod: string;
  podName: string;
  weightT: number;
  weight: string;
  reefer: boolean;
  dgClass: string | null;
  locked: boolean;
  /** The slot the container is placed in. */
  slot: SlotKey;
  lengthFt: 20 | 40;
}

export interface CellModel {
  /** The slot key in this view. */
  key: SlotKey;
  exists: boolean;
  plug: boolean;
  /** The container in the cell, or the 40ft container that covers a 20ft half. */
  box: CellBox | null;
  /** Two 20ft containers (or one half empty) in a cell of the 40ft view. */
  halves: [CellBox | null, CellBox | null] | null;
  violation: 'error' | 'warning' | null;
  selected: boolean;
  mark: CellMark | null;
  /** The text a screen reader reads for the cell. */
  label: string;
}

export interface TotalModel {
  exists: boolean;
  weight: string;
  /** Percent of the stack limit, up to 100. */
  percent: number;
  over: boolean;
  caution: boolean;
  title: string;
}

export interface TierModel {
  tier: number;
  cells: CellModel[];
}

export interface BayModel {
  bay: number;
  deck: TierModel[];
  hold: TierModel[];
  deckTotals: TotalModel[];
  holdTotals: TotalModel[];
}

export interface BayModelInput {
  ctx: StowContext;
  state: StowState;
  violations: ViolationIndex;
  bay: number;
  half: Half;
  selected: SlotKey | null;
  /** Marks for target slots while a container is held (M4). */
  marks?: ReadonlyMap<SlotKey, { mark: CellMark; reason?: string }>;
}

const last4 = (id: string): string => id.slice(-8, -2).slice(-4);

function toBox(p: Placement, c: Container): CellBox {
  return {
    id: c.id,
    last4: last4(c.id),
    pod: PODS[c.pod as keyof typeof PODS]?.short ?? c.pod,
    podName: PODS[c.pod as keyof typeof PODS]?.name ?? c.pod,
    weightT: c.weightT,
    weight: fmt1(c.weightT),
    reefer: c.type === 'RF',
    dgClass: c.imdgClass ?? null,
    locked: p.locked,
    slot: p.slotKey,
    lengthFt: c.lengthFt,
  };
}

function describe(
  key: SlotKey,
  box: CellBox | null,
  halves: CellModel['halves'],
  plug: boolean,
  violation: { severity: string; message: string } | null,
  mark: { mark: CellMark; reason?: string } | undefined,
): string {
  const parts: string[] = [key];
  if (halves) {
    parts.push(
      halves
        .map(
          (h, i) =>
            `${i === 0 ? 'fore' : 'aft'} ${h ? `${h.id}, ${h.podName}, ${h.weight} tonnes` : 'empty'}`,
        )
        .join('; '),
    );
  } else if (box) parts.push(`${box.id}, ${box.podName}, ${box.weight} tonnes`);
  else parts.push('empty');
  if (plug) parts.push('reefer plug');
  if (box?.locked) parts.push('locked');
  if (violation) parts.push(`${violation.severity}: ${violation.message}`);
  if (mark) {
    parts.push(
      mark.mark === 'origin'
        ? 'picked up from here'
        : mark.mark === 'invalid'
          ? `invalid target${mark.reason ? `: ${mark.reason}` : ''}`
          : mark.mark === 'warning'
            ? `valid target with warning${mark.reason ? `: ${mark.reason}` : ''}`
            : 'valid target',
    );
  }
  return parts.join(', ');
}

export function buildBayModel(input: BayModelInput): BayModel {
  const { ctx, state, violations, bay, half, selected, marks } = input;
  const b = ctx.geometry.bayByNum(bay);
  if (!b) throw new Error(`Unknown bay ${bay}`);

  const contentOf = (key: SlotKey): CellBox | null => {
    const p = state.placements.get(key);
    const c = p && ctx.containers.get(p.containerId);
    return p && c ? toBox(p, c) : null;
  };

  const cell = (row: number, tier: number, rows: number): CellModel => {
    const key = slotKeyFor(bay, row, tier, half);
    const exists = row <= rows && ctx.geometry.slotExists(key);
    if (!exists) {
      return {
        key,
        exists,
        plug: false,
        box: null,
        halves: null,
        violation: null,
        selected: false,
        mark: null,
        label: '',
      };
    }
    const plug = ctx.geometry.hasPlug(key);
    let box: CellBox | null = null;
    let halves: CellModel['halves'] = null;
    if (half === 'both') {
      box = contentOf(key);
      if (!box) {
        const fore = contentOf(slotKeyFor(bay, row, tier, 'fore'));
        const aft = contentOf(slotKeyFor(bay, row, tier, 'aft'));
        if (fore || aft) halves = [fore, aft];
      }
    } else {
      box = contentOf(key) ?? contentOf(slotKeyFor(bay, row, tier, 'both'));
    }
    const shown = box ?? halves?.find((h) => h !== null) ?? null;
    const boxes: CellBox[] = box ? [box] : (halves?.filter((h): h is CellBox => h !== null) ?? []);
    let v: Violation | undefined;
    for (const x of boxes) {
      const found = violations.bySlot.get(x.slot);
      if (found && (!v || (found.severity === 'error' && v.severity !== 'error'))) v = found;
    }
    const mark = marks?.get(key);
    const isSelected =
      selected !== null &&
      (halves ? halves.some((h) => h?.slot === selected) : box?.slot === selected);
    return {
      key,
      exists,
      plug,
      box,
      halves,
      violation: v ? v.severity : null,
      selected: isSelected && shown !== null,
      mark: mark?.mark ?? null,
      label: describe(key, box, halves, plug, v ?? null, mark),
    };
  };

  const tiers = (list: readonly number[], rows: number): TierModel[] =>
    [...list].reverse().map((tier) => ({
      tier,
      cells: ALL_ROWS.map((row) => cell(row, tier, rows)),
    }));

  const totals = (deck: boolean, rows: number): TotalModel[] =>
    ALL_ROWS.map((row) => {
      if (row > rows)
        return { exists: false, weight: '', percent: 0, over: false, caution: false, title: '' };
      const id = `${bay}-${row}-${deck ? 'D' : 'H'}`;
      const w = stackWeightTenths(state, ctx, id);
      const limit = stackLimitTenths(ctx, id);
      return {
        exists: true,
        weight: fmtTenths(w),
        percent: Math.min(100, (w / limit) * 100),
        over: w > limit,
        caution: w <= limit && (w / limit) * 100 > 90,
        title: `Stack ${String(bay).padStart(2, '0')}-${String(row).padStart(2, '0')} ${deck ? 'deck' : 'hold'}: ${fmtTenths(w)} t of ${fmtTenths(limit)} t`,
      };
    });

  return {
    bay,
    deck: tiers(b.deckTiers, b.deckRows),
    hold: tiers(b.holdTiers, b.holdRows),
    deckTotals: totals(true, b.deckRows),
    holdTotals: totals(false, b.holdRows),
  };
}

/** The first slot to focus in a bay: the lowest slot with a container, or the first deck slot. */
export function defaultFocus(ctx: StowContext, state: StowState, bay: number, half: Half): SlotKey {
  const b = ctx.geometry.bayByNum(bay);
  if (!b) throw new Error(`Unknown bay ${bay}`);
  const first = [...state.placements.keys()]
    .filter((k) => +slot40Key(k).slice(0, 2) === bay)
    .sort()[0];
  if (first && half === 'both') return first;
  return slotKeyFor(bay, ALL_ROWS.find((r) => r <= b.deckRows) ?? 1, 82, half);
}

/**
 * The slot reached by an arrow key from a slot, in the grid as drawn: columns are rows from
 * port to starboard, tiers run from the top of the deck to the bottom of the hold.
 * Skips cells that do not exist. Returns null at the edge.
 */
export function nextFocus(
  ctx: StowContext,
  bay: number,
  half: Half,
  from: SlotKey,
  dRow: number,
  dTier: number,
): SlotKey | null {
  const b = ctx.geometry.bayByNum(bay);
  if (!b) return null;
  const tiers = [...b.deckTiers].reverse().concat([...b.holdTiers].reverse());
  const f = { row: +from.slice(2, 4), tier: +from.slice(4, 6) };
  let ri = ALL_ROWS.indexOf(f.row);
  let ti = Math.max(0, tiers.indexOf(f.tier));
  for (let n = 0; n < 20; n++) {
    ri += dRow;
    ti += dTier;
    if (ri < 0 || ri >= ALL_ROWS.length || ti < 0 || ti >= tiers.length) return null;
    const key = slotKeyFor(bay, ALL_ROWS[ri]!, tiers[ti]!, half);
    if (ctx.geometry.slotExists(key)) return key;
  }
  return null;
}
