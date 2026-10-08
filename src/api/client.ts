import type { LoadListItem } from '@/domain';
import { ApiError } from './errors';
import type {
  ActivityEntry,
  ErrorBody,
  ImportResponse,
  NewPlanRequest,
  PlanDetail,
  PlanListResponse,
  PlanSummary,
  PlansQuery,
  SaveRequest,
  SaveResponse,
  Session,
  StatusRequest,
  VesselDetail,
  VesselSummary,
} from './types';

// The typed client for the ten endpoints. A failed request throws ApiError with the code and
// the message for the user; the screens show it with Retry (NFR-18).

export interface Api {
  listPlans(query?: PlansQuery): Promise<PlanListResponse>;
  createPlan(body: NewPlanRequest): Promise<PlanSummary>;
  getPlan(id: string): Promise<PlanDetail>;
  savePlan(id: string, body: SaveRequest): Promise<SaveResponse>;
  setStatus(id: string, body: StatusRequest): Promise<PlanSummary>;
  getLoadList(id: string): Promise<LoadListItem[]>;
  importLoadList(id: string, fileText: string): Promise<ImportResponse>;
  getActivity(id: string): Promise<ActivityEntry[]>;
  exportPlan(id: string): Promise<{ filename: string; text: string }>;
  getVessel(id: string): Promise<VesselDetail>;
  listVessels(): Promise<VesselSummary[]>;
}

export function createApi(session: () => Session, baseUrl = '/api'): Api {
  async function request<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'X-Role': session().role,
          'X-User': session().user,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body:
          body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, { code: 'network', message: 'The server could not be reached.' });
    }
    if (!res.ok) {
      let err: ErrorBody;
      try {
        err = (await res.json()) as ErrorBody;
        if (typeof err.code !== 'string' || typeof err.message !== 'string') throw new Error();
      } catch {
        err = { code: 'server', message: `The server answered with an error (${res.status}).` };
      }
      throw new ApiError(res.status, err);
    }
    return (raw ? await res.text() : await res.json()) as T;
  }

  const q = (query: PlansQuery = {}) => {
    const p = new URLSearchParams();
    if (query.status) p.set('status', query.status);
    if (query.q) p.set('q', query.q);
    if (query.mine) p.set('mine', 'true');
    if (query.hasViolations) p.set('hasViolations', 'true');
    if (query.sort) p.set('sort', query.sort);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const enc = encodeURIComponent;

  return {
    listPlans: (query) => request('GET', `/plans${q(query)}`),
    createPlan: (body) => request('POST', '/plans', body),
    getPlan: (id) => request('GET', `/plans/${enc(id)}`),
    savePlan: (id, body) => request('PUT', `/plans/${enc(id)}`, body),
    setStatus: (id, body) => request('POST', `/plans/${enc(id)}/status`, body),
    getLoadList: (id) => request('GET', `/plans/${enc(id)}/load-list`),
    importLoadList: (id, fileText) =>
      request('POST', `/plans/${enc(id)}/load-list/import`, fileText),
    getActivity: (id) => request('GET', `/plans/${enc(id)}/activity`),
    async exportPlan(id) {
      const text = await request<string>('GET', `/plans/${enc(id)}/export`, undefined, true);
      return { filename: `stowline-plan-${id}.json`, text };
    },
    getVessel: (id) => request('GET', `/vessels/${enc(id)}`),
    listVessels: () => request('GET', '/vessels'),
  };
}
