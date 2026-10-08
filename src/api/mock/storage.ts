import type { Container, Placement, StabilityBase, Vessel } from '@/domain';
import type { ActivityEntry, PlanPreview, ServerChange } from '../types';

// What the mock keeps. Plans are kept in IndexedDB, so saved work survives a reload (SRS).

export interface PlanRecord {
  id: string;
  vesselId: string;
  vessel: string;
  teu: number;
  imo: string;
  voyage: string;
  port: string;
  etd: string;
  status: 'draft' | 'in_review' | 'approved';
  version: number;
  planner: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  statusBy?: string | null;
  statusAt?: string | null;
  activity: ActivityEntry[];
  /** The saved versions with their commands, newest last, so a 409 can carry them (decision 6). */
  versions?: ServerChange[];
  /** Plans with geometry and placements (decision D11). The others only have their summary. */
  data: {
    placements: Placement[];
    shiftCount: number;
    /** Every container placed on the plan. */
    containers: Container[];
    /** Every container on the load list. */
    loadList: Container[];
    stabilityBase: StabilityBase;
  } | null;
  /** The summary of a plan without data. */
  fixed: {
    planned: number;
    total: number;
    errors: number;
    warnings: number;
    preview: PlanPreview;
  } | null;
}

export interface VesselRecord {
  id: string;
  vessel: Vessel;
  stabilityBase: StabilityBase;
  /** The arrival condition a new plan starts from: containers on board from earlier ports. */
  arrival: { containers: Container[]; placements: Placement[] };
}

export interface MockStorage {
  load(): Promise<{ plans: PlanRecord[]; vessels: VesselRecord[] }>;
  putPlan(record: PlanRecord): Promise<void>;
  putVessel(record: VesselRecord): Promise<void>;
}

export function memoryStorage(): MockStorage {
  const plans = new Map<string, PlanRecord>();
  const vessels = new Map<string, VesselRecord>();
  return {
    load: () => Promise.resolve({ plans: [...plans.values()], vessels: [...vessels.values()] }),
    putPlan: (r) => {
      plans.set(r.id, structuredClone(r));
      return Promise.resolve();
    },
    putVessel: (r) => {
      vessels.set(r.id, structuredClone(r));
      return Promise.resolve();
    },
  };
}

const DB = 'stowline-mock';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('plans', { keyPath: 'id' });
      req.result.createObjectStore('vessels', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB is not available'));
  });
}

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });

export function indexedDbStorage(): MockStorage {
  let db: Promise<IDBDatabase> | undefined;
  const get = () => (db ??= open());
  return {
    async load() {
      const d = await get();
      const plans = await wrap(
        d.transaction('plans').objectStore('plans').getAll() as IDBRequest<PlanRecord[]>,
      );
      const vessels = await wrap(
        d.transaction('vessels').objectStore('vessels').getAll() as IDBRequest<VesselRecord[]>,
      );
      return { plans, vessels };
    },
    async putPlan(r) {
      const d = await get();
      await wrap(d.transaction('plans', 'readwrite').objectStore('plans').put(r));
    },
    async putVessel(r) {
      const d = await get();
      await wrap(d.transaction('vessels', 'readwrite').objectStore('vessels').put(r));
    },
  };
}
