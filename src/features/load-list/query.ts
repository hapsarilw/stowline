import { PODS, type PodCode } from '@/domain';
import type { Container, ContainerType, SlotKey } from '@/domain';

// Search, filter and sort of the load list (FR-13). Pure functions, so the component stays thin.

export type SortKey = 'id' | 'type' | 'weight' | 'pod' | 'flags';

export interface ListQuery {
  q: string;
  pod: PodCode | null;
  type: ContainerType | null;
  reefer: boolean;
  dg: boolean;
  unplannedOnly: boolean;
  sortKey: SortKey;
  /** 1 ascending, -1 descending. */
  sortDir: 1 | -1;
}

export const defaultQuery = (): ListQuery => ({
  q: '',
  pod: null,
  type: null,
  reefer: false,
  dg: false,
  unplannedOnly: true,
  sortKey: 'weight',
  sortDir: -1,
});

/** Types in the order the Type filter lists them. */
export const TYPE_ORDER: readonly ContainerType[] = ['40HC', '40GP', '20GP', 'RF', 'TK', 'OT'];

export interface LoadRow {
  container: Container;
  /** The slot the container is placed in, or an empty string. */
  slot: SlotKey;
}

export function toRows(
  loadList: readonly Container[],
  slotOf: ReadonlyMap<string, SlotKey>,
): LoadRow[] {
  return loadList.map((container) => ({ container, slot: slotOf.get(container.id) ?? '' }));
}

const isPod = (code: string): code is PodCode => code in PODS;

const podName = (code: string): string => (isPod(code) ? PODS[code].name : code);
const podOrder = (code: string): number =>
  isPod(code) ? PODS[code].order : Number.MAX_SAFE_INTEGER;

/** Reefer and dangerous goods flags as a number, so the Flags column can sort. */
export const flagsRank = (c: Container): number =>
  (c.type === 'RF' ? 2 : 0) + (c.imdgClass ? 1 : 0);

function compare(a: LoadRow, b: LoadRow, key: SortKey): number {
  const x = a.container;
  const y = b.container;
  switch (key) {
    case 'id':
      return x.id.localeCompare(y.id);
    case 'type':
      return x.type.localeCompare(y.type);
    case 'weight':
      return x.weightT - y.weightT;
    case 'pod':
      return podOrder(x.pod) - podOrder(y.pod);
    case 'flags':
      return flagsRank(x) - flagsRank(y);
  }
}

export function queryRows(rows: readonly LoadRow[], query: ListQuery): LoadRow[] {
  const q = query.q.trim().toLowerCase();
  const kept = rows.filter(({ container: c, slot }) => {
    if (query.unplannedOnly && slot) return false;
    if (query.pod && c.pod !== query.pod) return false;
    if (query.type && c.type !== query.type) return false;
    if (query.reefer && c.type !== 'RF') return false;
    if (query.dg && !c.imdgClass) return false;
    if (!q) return true;
    return `${c.id} ${c.pod} ${c.type} ${podName(c.pod)} ${slot}`.toLowerCase().includes(q);
  });
  // Array.prototype.sort is stable, so equal rows keep the list order.
  return kept.sort((a, b) => compare(a, b, query.sortKey) * query.sortDir);
}

/** The sort a column starts with: heaviest first for weight, A to Z for the rest. */
export const defaultDir = (key: SortKey): 1 | -1 => (key === 'weight' || key === 'flags' ? -1 : 1);

export function sortBy(query: ListQuery, key: SortKey): Pick<ListQuery, 'sortKey' | 'sortDir'> {
  if (query.sortKey === key) return { sortKey: key, sortDir: query.sortDir === 1 ? -1 : 1 };
  return { sortKey: key, sortDir: defaultDir(key) };
}
