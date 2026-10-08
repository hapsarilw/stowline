import type {
  Command,
  Container,
  LoadListItem,
  Plan,
  PlanStatus,
  RejectedRow,
  Role,
  StabilityBase,
  Vessel,
} from '@/domain';

// The wire types of the ten endpoints (SRS "Interfaces"). The same types serve the client and
// the mock, so a change to the contract is a compile error on both sides.

export type GaugeWord = 'ok' | 'check' | 'limit';

export interface PlanPreview {
  /** Per bay from bow to stern: share of deck and hold slots filled, 0 to 1. */
  bayFill: { deck: number; hold: number }[];
  /** Bay indexes drawn red: where an error sits. */
  errorBays: number[];
  stability: {
    gm: number;
    trim: number;
    list: number;
    gmState: GaugeWord;
    trimState: GaugeWord;
    listState: GaugeWord;
  };
  violationsByRule: { label: string; severity: 'error' | 'warning'; count: number }[];
}

export interface PlanSummary {
  id: string;
  vesselId: string;
  vessel: string;
  teu: number;
  imo: string;
  voyage: string;
  port: string;
  etd: string;
  status: PlanStatus;
  version: number;
  planned: number;
  total: number;
  errors: number;
  warnings: number;
  planner: string | null;
  /** ISO time of the last change, or null for a plan nobody has touched. */
  updatedAt: string | null;
  /** Only plans with vessel geometry and placements can be opened (decision D11). */
  openable: boolean;
  preview: PlanPreview;
}

export interface PlanListResponse {
  plans: PlanSummary[];
  /** Counts for the status tabs, over all plans. */
  counts: { all: number; draft: number; in_review: number; approved: number };
}

export interface PlanDetail extends Plan {
  /** Every container placed on the plan. The load list rows come from the load list endpoint. */
  containers: Container[];
  stabilityBase: StabilityBase;
  updatedAt: string;
  updatedBy: string;
  planner: string | null;
  /** Who last changed the status, and when. */
  statusBy: string | null;
  statusAt: string | null;
}

export interface NewPlanRequest {
  vesselId: string;
  voyage: string;
  port: string;
  etd: string;
}

export interface SaveRequest {
  baseVersion: number;
  commands: Command[];
}

export interface SaveResponse {
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface StatusRequest {
  to: PlanStatus;
  comment?: string;
}

export interface ImportResponse {
  accepted: number;
  rejected: RejectedRow[];
}

export interface ActivityEntry {
  at: string;
  user: string;
  text: string;
}

export interface VesselDetail {
  vessel: Vessel;
  stabilityBase: StabilityBase;
}

export interface VesselSummary {
  id: string;
  name: string;
  teu: number;
  imo: string;
}

export type LoadListResponse = LoadListItem[];

export interface PlansQuery {
  status?: PlanStatus;
  q?: string;
  mine?: boolean;
  hasViolations?: boolean;
  sort?: 'etd' | '-etd';
}

/** Every error response has this shape (SRS "Interfaces"). */
export interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** One version saved on the server: who, when, and its commands (decision 6). */
export interface ServerChange {
  version: number;
  savedBy: string;
  savedAt: string;
  commands: Command[];
  /** One line per command, for people. */
  lines: string[];
}

/** The body of a 409 on save (decision 6). */
export interface ConflictDetails {
  currentVersion: number;
  savedBy: string;
  savedAt: string;
  /** Every version saved after the base version of the refused save, oldest first. */
  changes: ServerChange[];
}

export interface Session {
  role: Role;
  user: string;
}
