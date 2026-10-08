import { CONTAINER_TYPES } from '../constants';
import { ROTATION } from '../sample/rotation';
import type { Container, ContainerType } from '../types';

// Importing a load list file (FR-64, SRS "Load list file"). The file is data: it is parsed, each
// row is checked, and nothing from it is ever used as markup (NFR-19).

export interface ImportOptions {
  /** The plan's port: a POD must come later in the rotation. */
  port: string;
  /** IDs already on the plan. */
  existingIds: ReadonlySet<string>;
}

export interface RejectedRow {
  /** 1-based position in the file. */
  row: number;
  /** The ID as written, cut to MAX_REASON_ID characters. Show it as text. */
  id: string;
  reason: string;
}

export type ImportResult =
  { ok: true; accepted: Container[]; rejected: RejectedRow[] } | { ok: false; message: string };

export const MAX_REASON_ID = 40;

const ID_FORMAT = /^[A-Z]{4} \d{6} \d$/;
const TYPES = Object.keys(CONTAINER_TYPES) as ContainerType[];
// The classes of the segregation table, and the other IMDG classes and divisions.
const IMDG = new Set([
  '1',
  '2.1',
  '2.2',
  '2.3',
  '3',
  '4.1',
  '4.2',
  '4.3',
  '5.1',
  '5.2',
  '6.1',
  '6.2',
  '7',
  '8',
  '9',
]);

const own = (o: object, k: string): unknown =>
  Object.prototype.hasOwnProperty.call(o, k) ? (o as Record<string, unknown>)[k] : undefined;

const shown = (v: unknown): string =>
  (typeof v === 'string' ? v : v === undefined ? '' : (JSON.stringify(v) ?? '')).slice(
    0,
    MAX_REASON_ID,
  );

/** The row's problem, or the container it describes. */
function checkRow(
  raw: unknown,
  seen: Set<string>,
  o: ImportOptions,
): { reason: string } | { container: Container } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { reason: 'The row is not an object.' };
  const id = own(raw, 'id');
  if (typeof id !== 'string' || !ID_FORMAT.test(id))
    return { reason: 'ID must be 4 letters, 6 digits and 1 check digit, like NSPU 482913 5.' };
  if (seen.has(id)) return { reason: 'ID is repeated in the file.' };
  if (o.existingIds.has(id)) return { reason: 'ID is already on this plan.' };
  const type = own(raw, 'type');
  if (typeof type !== 'string' || !TYPES.includes(type as ContainerType))
    return { reason: `Type must be one of ${TYPES.join(', ')}.` };
  const weight = own(raw, 'weightT');
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 2 || weight > 35)
    return { reason: 'Weight must be between 2.0 and 35.0 t.' };
  const pod = own(raw, 'pod');
  const rank = (code: unknown) => ROTATION.findIndex((p) => p.code === code);
  if (typeof pod !== 'string' || rank(pod) < 0 || rank(pod) <= rank(o.port))
    return { reason: `POD must be a port after ${o.port} in the rotation.` };
  const temp = own(raw, 'reeferSetPointC');
  if (type === 'RF' && (typeof temp !== 'number' || !Number.isFinite(temp)))
    return { reason: 'A reefer needs a set point in °C.' };
  const imdg = own(raw, 'imdgClass');
  if (imdg !== undefined && (typeof imdg !== 'string' || !IMDG.has(imdg)))
    return { reason: `IMDG class ${shown(imdg)} is not a known class.` };

  seen.add(id);
  const info = CONTAINER_TYPES[type as ContainerType];
  const container: Container = {
    id,
    type: type as ContainerType,
    isoCode: info.iso,
    lengthFt: info.lengthFt,
    weightT: Math.round(weight * 10) / 10,
    pol: o.port,
    pod,
  };
  if (type === 'RF') container.reeferSetPointC = temp as number;
  if (typeof imdg === 'string') container.imdgClass = imdg;
  return { container };
}

export function parseLoadListFile(text: string, o: ImportOptions): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The file is not valid JSON.' };
  }
  const rows = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray(own(data, 'containers'))
      ? (own(data, 'containers') as unknown[])
      : null;
  if (!rows)
    return {
      ok: false,
      message: 'The file must hold a list of containers, or an object with a containers list.',
    };

  const seen = new Set<string>();
  const accepted: Container[] = [];
  const rejected: RejectedRow[] = [];
  rows.forEach((raw, i) => {
    const r = checkRow(raw, seen, o);
    if ('container' in r) accepted.push(r.container);
    else
      rejected.push({
        row: i + 1,
        id: shown(typeof raw === 'object' && raw !== null ? own(raw as object, 'id') : undefined),
        reason: r.reason,
      });
  });
  return { ok: true, accepted, rejected };
}
