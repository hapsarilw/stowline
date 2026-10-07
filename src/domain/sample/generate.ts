import { CONTAINER_TYPES, PODS, type PodCode } from '../constants';
import { createGeometry, rowsFor, slotKey, slotKeyFor, type Geometry } from '../geometry';
import type { Container, ContainerType, LoadListItem, Placement, Plan, Vessel } from '../types';
import { createSampleVessel } from '../geometry/vessel';
import { randomId, uniqueId } from './ids';
import { CURRENT_PORT, PREVIOUS_PORT } from './rotation';
import { createRng, type Rng } from './rng';

// The seeded sample call, ported from createPlan and createLoadList in design/stowline-data.js.
// The random draws are kept in the same order, so every container the prototype put on board is
// still in the same slot with the same weight, POD and type.

export const LOAD_LIST_TOTAL = 1240;
export const PLANNED_TOTAL = 312;

const PLAN_SEED = 8500;
const LOAD_LIST_SEED = 1240;
const EXTRA_PLANNED_SEED = 312;

interface RawBox {
  id: string;
  named: boolean;
  scripted: boolean;
  type: ContainerType;
  w: number;
  pod: PodCode;
  pol: string;
  dg: string | null;
  temp: number | undefined;
  locked: boolean;
  len: 20 | 40;
  bay: number;
  row: number;
  tier: number;
  deck: boolean;
}

interface ScriptedEntry {
  id?: string;
  w: number;
  pod: PodCode;
  type?: ContainerType;
  len?: 20;
  dg?: string;
  pol?: string;
  temp?: number;
}

interface RawListItem {
  id: string;
  named: boolean;
  type: ContainerType;
  w: number;
  pod: PodCode;
  dg: string | null;
  temp: number | undefined;
}

function pickPod(r: Rng): PodCode {
  const v = r();
  return v < 0.22 ? 'LKCMB' : v < 0.47 ? 'AEJEA' : v < 0.77 ? 'NLRTM' : 'DEHAM';
}

function generateRawPlan(vessel: Vessel, geometry: Geometry): Map<string, RawBox> {
  const r = createRng(PLAN_SEED);
  const slots = new Map<string, RawBox>();
  const { stackDeckT, stackHoldT } = vessel.limits;

  const put = (
    bay: number,
    row: number,
    tier: number,
    o: Pick<RawBox, 'id' | 'w' | 'pod'> & Partial<RawBox>,
  ) => {
    slots.set(slotKey(bay, row, tier), {
      type: '40HC',
      pol: PREVIOUS_PORT,
      dg: null,
      temp: undefined,
      locked: false,
      len: 40,
      named: false,
      scripted: false,
      bay,
      row,
      tier,
      deck: tier >= 82,
      ...o,
    });
  };

  const fill = (bay: number, row: number, tiers: number[], deck: boolean, index: number) => {
    const n = tiers.length;
    if (!n) return;
    const pods: PodCode[] = [];
    for (let k = 0; k < n; k++) pods.push(pickPod(r));
    pods.sort((a, c) => PODS[c].order - PODS[a].order);
    const ws: number[] = [];
    for (let k = 0; k < n; k++) ws.push(deck ? 8 + r() * 18 : 12 + r() * 18);
    ws.sort((a, c) => c - a);
    const lim = deck ? stackDeckT : stackHoldT;
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const w = Math.round(ws[k]! * 10) / 10;
      if (sum + w > lim - 1.5) break;
      sum += w;
      const t = tiers[k]!;
      const plug = geometry.hasPlug(slotKey(bay, row, t));
      let type: ContainerType = plug && r() < 0.45 ? 'RF' : r() < 0.66 ? '40HC' : '40GP';
      if (k === n - 1 && type !== 'RF' && r() < 0.06) type = 'OT';
      const id = randomId(r);
      const pol = deck && index < 9 && r() < 0.5 ? CURRENT_PORT : PREVIOUS_PORT;
      const dg = r() < 0.03 ? '9' : null;
      put(bay, row, t, {
        id,
        type,
        w,
        pod: pods[k]!,
        pol,
        dg,
        temp: type === 'RF' ? -18 : undefined,
      });
    }
  };

  for (const b of vessel.bays) {
    const f = b.index <= 13 ? 0.95 : b.index <= 16 ? 0.72 : b.index <= 18 ? 0.45 : 0.18;
    for (const row of rowsFor(b.holdRows)) {
      const L = b.holdTiers.length;
      const h = f > 0.9 ? L - (r() < 0.2 ? 1 : 0) : Math.round(L * f * (0.6 + r() * 0.7));
      fill(b.bay, row, b.holdTiers.slice(0, Math.max(0, Math.min(L, h))), false, b.index);
    }
    for (const row of rowsFor(b.deckRows)) {
      let h = f > 0.9 ? 2 + Math.floor(r() * 5) : Math.round(6 * f * (0.4 + r() * 0.9));
      if (f < 0.5 && r() < 0.45) h = 0;
      fill(b.bay, row, b.deckTiers.slice(0, Math.max(0, Math.min(6, h))), true, b.index);
    }
  }

  // Scripted stacks. They hold the named containers and the seven golden violations.
  const S = (bayNum: number, row: number, deck: boolean, list: ScriptedEntry[]) => {
    const b = geometry.bayByNum(bayNum)!;
    const tiers = deck ? b.deckTiers : b.holdTiers;
    for (const t of tiers) slots.delete(slotKey(bayNum, row, t));
    list.forEach((o, k) => {
      const drawn = randomId(r); // drawn even when the entry names its own id
      put(bayNum, row, tiers[k]!, {
        id: drawn,
        pol: CURRENT_PORT,
        ...o,
        named: o.id !== undefined,
        scripted: true,
      });
    });
  };
  S(18, 4, true, [
    { id: 'NSPU 730118 2', w: 26.8, pod: 'DEHAM' },
    { id: 'NSPU 615540 9', w: 24.1, pod: 'NLRTM' },
    { id: 'NSPU 482913 5', w: 28.4, pod: 'NLRTM' },
    { id: 'NSPU 771032 1', w: 17.1, pod: 'LKCMB', type: '40GP' },
  ]);
  S(18, 6, true, [
    { w: 25.0, pod: 'DEHAM' },
    { w: 24.2, pod: 'NLRTM' },
    { w: 23.1, pod: 'AEJEA' },
  ]);
  S(18, 2, true, [
    { w: 24.4, pod: 'DEHAM' },
    { w: 21.0, pod: 'AEJEA' },
  ]);
  S(18, 1, true, [
    { w: 22.8, pod: 'NLRTM' },
    { w: 19.5, pod: 'NLRTM', type: 'RF', temp: -18 },
    { w: 15.2, pod: 'AEJEA' },
  ]);
  S(18, 3, true, [
    { w: 26.1, pod: 'DEHAM' },
    { w: 25.5, pod: 'DEHAM' },
    { w: 22.9, pod: 'NLRTM' },
  ]);
  S(18, 8, true, [
    { w: 23.3, pod: 'NLRTM' },
    { w: 18.6, pod: 'LKCMB' },
  ]);
  S(18, 5, true, [
    { w: 21.7, pod: 'AEJEA' },
    { w: 20.2, pod: 'LKCMB' },
  ]);
  S(22, 6, false, [
    { w: 29.0, pod: 'DEHAM', pol: PREVIOUS_PORT },
    { w: 27.9, pod: 'DEHAM', pol: PREVIOUS_PORT },
    { w: 27.6, pod: 'NLRTM', pol: PREVIOUS_PORT },
    { w: 27.4, pod: 'NLRTM', pol: PREVIOUS_PORT },
    { id: 'NSPU 220417 3', w: 27.2, pod: 'NLRTM', type: 'RF', temp: -18 },
  ]);
  S(14, 2, true, [
    { w: 22.0, pod: 'DEHAM' },
    { id: 'NSPU 309915 7', w: 19.4, pod: 'NLRTM', type: '40GP', dg: '3' },
  ]);
  S(14, 4, true, [
    { w: 21.0, pod: 'DEHAM' },
    { id: 'NSPU 664201 0', w: 16.2, pod: 'NLRTM', type: '40GP', dg: '5.1' },
  ]);
  S(10, 3, true, [
    { id: 'NSPU 118377 4', w: 21.6, pod: 'LKCMB' },
    { id: 'NSPU 905126 8', w: 18.3, pod: 'NLRTM' },
    { id: 'NSPU 905127 3', w: 14.0, pod: 'NLRTM' },
  ]);
  S(30, 2, true, [
    { id: 'NSPU 402288 1', w: 22.4, pod: 'NLRTM' },
    { id: 'NSPU 318204 6', w: 12.6, pod: 'NLRTM', type: '20GP', len: 20 },
  ]);
  S(42, 8, true, [
    { id: 'NSPU 207714 8', w: 22.5, pod: 'AEJEA' },
    { id: 'NSPU 552870 6', w: 19.8, pod: 'DEHAM' },
  ]);
  S(46, 6, false, [
    { w: 29.1, pod: 'DEHAM', pol: PREVIOUS_PORT },
    { w: 27.4, pod: 'DEHAM', pol: PREVIOUS_PORT },
    { w: 25.0, pod: 'NLRTM', pol: PREVIOUS_PORT },
    { w: 21.2, pod: 'NLRTM', pol: PREVIOUS_PORT },
    { id: 'NSPU 640033 2', w: 8.4, pod: 'NLRTM', pol: PREVIOUS_PORT },
    { id: 'NSPU 813350 9', w: 30.2, pod: 'NLRTM', pol: PREVIOUS_PORT },
  ]);
  for (const k of ['180202', '180102', '180204']) {
    const box = slots.get(k);
    if (box) box.locked = true;
  }
  return slots;
}

/**
 * The prototype marks 253 containers as loaded at Singapore, the header says 312.
 * Mark the top container of more deck stacks as loaded at Singapore, until there are 312.
 * Only the port of loading changes. No container moves, changes weight or changes POD.
 */
function markMorePlanned(slots: Map<string, RawBox>): void {
  let planned = 0;
  for (const box of slots.values()) if (box.pol === CURRENT_PORT) planned++;
  const need = PLANNED_TOTAL - planned;
  if (need <= 0) return;

  const tops = new Map<string, RawBox>();
  for (const box of slots.values()) {
    if (!box.deck) continue;
    const id = `${box.bay}-${box.row}`;
    const top = tops.get(id);
    if (!top || box.tier > top.tier) tops.set(id, box);
  }
  const candidates = [...tops.values()]
    .filter((b) => b.pol === PREVIOUS_PORT && !b.scripted && !b.locked)
    .sort((a, b) => slotKey(a.bay, a.row, a.tier).localeCompare(slotKey(b.bay, b.row, b.tier)));
  if (candidates.length < need)
    throw new Error('Not enough deck stacks to reach the planned count');

  const r = createRng(EXTRA_PLANNED_SEED);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  for (const box of candidates.slice(0, need)) box.pol = CURRENT_PORT;
}

function generateRawLoadList(count: number): RawListItem[] {
  const r = createRng(LOAD_LIST_SEED);
  const list: RawListItem[] = [
    {
      id: 'NSPU 551208 4',
      named: true,
      type: '40HC',
      w: 24.1,
      pod: 'AEJEA',
      dg: null,
      temp: undefined,
    },
    { id: 'NSPU 337061 2', named: true, type: 'RF', w: 26.3, pod: 'NLRTM', dg: null, temp: -25 },
    {
      id: 'NSPU 908442 7',
      named: true,
      type: 'TK',
      w: 21.8,
      pod: 'AEJEA',
      dg: '3',
      temp: undefined,
    },
  ];
  const types: ContainerType[] = [
    '40HC',
    '40HC',
    '40HC',
    '40HC',
    '40GP',
    '40GP',
    '20GP',
    'RF',
    'TK',
    'OT',
  ];
  while (list.length < count) {
    const type = types[Math.floor(r() * types.length)]!;
    const len = CONTAINER_TYPES[type].lengthFt;
    const w = Math.round((len === 20 ? 7 + r() * 19 : 5 + r() * 25) * 10) / 10;
    const id = randomId(r);
    const pod = pickPod(r);
    const dg =
      type === 'TK'
        ? ['3', '8', '6.1'][Math.floor(r() * 3)]!
        : r() < 0.04
          ? ['9', '2.1'][Math.floor(r() * 2)]!
          : null;
    const temp = type === 'RF' ? (r() < 0.5 ? -18 : 4) : undefined;
    list.push({ id, named: false, type, w, pod, dg, temp });
  }
  return list;
}

function toContainer(b: {
  id: string;
  type: ContainerType;
  w: number;
  pod: PodCode;
  pol: string;
  dg: string | null;
  temp: number | undefined;
}): Container {
  const info = CONTAINER_TYPES[b.type];
  const c: Container = {
    id: b.id,
    type: b.type,
    isoCode: info.iso,
    lengthFt: info.lengthFt,
    weightT: b.w,
    pol: b.pol,
    pod: b.pod,
  };
  if (b.type === 'RF') c.reeferSetPointC = b.temp ?? -18;
  if (b.dg) c.imdgClass = b.dg;
  return c;
}

export interface SampleCall {
  vessel: Vessel;
  plan: Plan;
  /** Every container on board, 2,740 of them. */
  containers: Container[];
  /** 1,240 rows. The ones for containers on board at SGSIN are planned. */
  loadList: LoadListItem[];
}

/** The seeded sample call: MV Nusantara Pioneer, voyage 042W, at Singapore. */
export function generateSampleCall(): SampleCall {
  const vessel = createSampleVessel();
  const geometry = createGeometry(vessel);

  const slots = generateRawPlan(vessel, geometry);
  markMorePlanned(slots);
  const rawList = generateRawLoadList(LOAD_LIST_TOTAL - PLANNED_TOTAL);

  // Random IDs can repeat. Named containers keep their ID, the others move to the next free serial.
  const used = new Set<string>();
  for (const b of slots.values()) if (b.named) used.add(b.id);
  for (const x of rawList) if (x.named) used.add(x.id);

  const ordered = [...slots.entries()]
    .map(([, b]) => ({ key: slotKey(b.bay, b.row, b.tier), b }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const containers: Container[] = [];
  const placements: Placement[] = [];
  const containerBySlot = new Map<string, Container>();
  for (const { b } of ordered) {
    if (!b.named) {
      b.id = uniqueId(b.id, used);
      used.add(b.id);
    }
    const container = toContainer(b);
    const half = b.len === 20 ? 'fore' : 'both';
    const key = slotKeyFor(b.bay, b.row, b.tier, half);
    containers.push(container);
    containerBySlot.set(key, container);
    placements.push({
      containerId: container.id,
      slotKey: key,
      half,
      locked: b.locked,
      origin: b.pol === CURRENT_PORT ? 'thisCall' : 'onboard',
    });
  }

  const loadList: LoadListItem[] = rawList.map((x) => {
    if (!x.named) {
      x.id = uniqueId(x.id, used);
      used.add(x.id);
    }
    return { container: toContainer({ ...x, pol: CURRENT_PORT }), plannedSlotKey: '' };
  });
  for (const p of placements) {
    if (p.origin === 'thisCall') {
      loadList.push({ container: containerBySlot.get(p.slotKey)!, plannedSlotKey: p.slotKey });
    }
  }

  const plan: Plan = {
    id: '042W-SGSIN',
    vesselId: vessel.id,
    voyage: '042W',
    port: CURRENT_PORT,
    etd: '2026-10-08T22:00:00+08:00',
    status: 'draft',
    version: 14,
    placements,
    plannerId: 'rina-adiputri',
    shiftCount: 0,
  };

  return { vessel, plan, containers, loadList };
}
