// Domain types from the SRS section "Data model".
// Coordinates: x along the ship (positive toward the bow), y positive to port,
// z height, all in metres. Weights are in tonnes, angles in degrees.

/** 'BBRRTT': bay, row, tier. Even bays hold 40ft containers, odd bays hold 20ft halves. */
export type SlotKey = string;

export type RuleId = 'stack' | 'reefer' | 'dg' | 'overstow' | 'twenty' | 'heavy';

export type ContainerType = '20GP' | '40GP' | '40HC' | 'RF' | 'TK' | 'OT';

/** fore and aft are the two 20ft halves of a 40ft slot. both is a 40ft container. */
export type Half = 'fore' | 'aft' | 'both';

export type PlanStatus = 'draft' | 'in_review' | 'approved';

export interface Container {
  id: string; // 'NSPU 482913 5'
  type: ContainerType;
  isoCode: string;
  lengthFt: 20 | 40;
  weightT: number; // VGM in tonnes, one decimal
  pol: string; // UN/LOCODE, 'SGSIN'
  pod: string;
  reeferSetPointC?: number;
  imdgClass?: string; // '3', '5.1'
}

export interface Placement {
  containerId: string;
  slotKey: SlotKey;
  half: Half;
  locked: boolean;
  origin: 'onboard' | 'thisCall';
}

export interface Plan {
  id: string;
  vesselId: string;
  voyage: string;
  port: string;
  etd: string; // ISO 8601
  status: PlanStatus;
  version: number;
  placements: Placement[];
  plannerId: string;
  /** Moves of containers loaded at an earlier port, made at this port (BR-17). */
  shiftCount: number;
}

export interface LoadListItem {
  container: Container;
  /** An empty string until the container is placed. */
  plannedSlotKey: SlotKey;
}

export interface Violation {
  id: string; // 'stack:18-4-D', stable for the same rule and slot
  rule: RuleId;
  severity: 'error' | 'warning';
  /** The slot the violation is shown at: the top of an overweight stack, the blocked container, and so on. */
  slot: SlotKey;
  /** The 40ft bay of that slot, for the bay navigator and the camera. */
  bay: number;
  slotKeys: SlotKey[];
  message: string;
  data?: { restows?: number; overT?: number; port?: string };
}

export type Command =
  | { kind: 'place'; containerId: string; to: SlotKey }
  | { kind: 'move'; from: SlotKey; to: SlotKey }
  | { kind: 'unplace'; from: SlotKey }
  | { kind: 'swap'; a: SlotKey; b: SlotKey }
  | { kind: 'lock' | 'unlock'; at: SlotKey }
  // Decision D2 (docs/BUILD_NOTES.md): a fix made of several commands runs and inverts as one.
  | { kind: 'batch'; commands: Command[] };

export interface HistoryEntry {
  command: Command;
  inverse: Command;
}

export interface Bay {
  /** The 40ft bay number: 02 to 86 in steps of 4. Its 20ft halves are bay-1 (fore) and bay+1 (aft). */
  bay: number;
  index: number;
  x: number;
  /** Number of rows. Rows are numbered 1..n: even to port, odd to starboard. */
  deckRows: number;
  holdRows: number;
  deckTiers: number[];
  holdTiers: number[];
}

export interface VesselLimits {
  stackDeckT: number;
  stackHoldT: number;
  heavyDeltaT: number;
  gmMinM: number;
  gmCheckM: number;
  trimLimitM: number;
  trimCheckM: number;
  listLimitDeg: number;
  listCheckDeg: number;
  strengthLimitPct: number;
  strengthCheckPct: number;
  shearLimitT: number;
  bendingLimitTm: number;
}

export interface Hydrostatics {
  referenceDisplacementT: number;
  referenceDeadweightT: number;
  km: number;
  referenceKg: number;
  /** Moment to change trim, t m per cm. */
  mtc: number;
  /** Longitudinal centre of flotation as x, negative is aft of the middle of the cargo length. */
  lcf: number;
  /** Tonnes per cm of sinkage. */
  tpc: number;
  referenceMeanDraftM: number;
  summerDraftM: number;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  teu: number;
  bays: Bay[];
  /** Slot keys of the 40ft slots that have a reefer plug. */
  plugs: SlotKey[];
  deckhouseX: number;
  limits: VesselLimits;
  hydrostatics: Hydrostatics;
}

export interface Slot {
  bay: number;
  row: number;
  tier: number;
  half: Half;
  hasPlug: boolean;
}

/** Derived from the plan. Never stored. */
export interface StabilityResult {
  gm: number;
  trim: number;
  list: number;
  draftFwd: number;
  draftAft: number;
  bmPct: number;
  sfPct: number;
  bmCurve: number[];
  sfCurve: number[];
}
