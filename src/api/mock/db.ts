import {
  bayOccupancy,
  computeStability,
  createStowContext,
  createStowState,
  gaugeState,
  validateAll,
  type Container,
  type StowContext,
  type StowState,
  type Violation,
} from '@/domain';
import { RULE_TITLES } from '@/state/messages';
import type { PlanPreview, PlanSummary } from '../types';
import { seedRecords } from './seed';
import type { MockStorage, PlanRecord, VesselRecord } from './storage';

// The mock's database: the records in memory, written through to the storage, and the
// summaries worked out from the plans with the domain functions.

export interface Computed {
  ctx: StowContext;
  state: StowState;
  violations: Violation[];
}

const RULE_ORDER = ['overstow', 'stack', 'reefer', 'dg', 'twenty', 'heavy'] as const;

export class MockDb {
  private plans = new Map<string, PlanRecord>();
  private vessels = new Map<string, VesselRecord>();
  private cache = new Map<string, { computed: Computed; summary: PlanSummary }>();
  readonly ready: Promise<void>;

  constructor(private readonly storage: MockStorage) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    let all = await this.storage.load();
    if (all.plans.length === 0) {
      const seed = seedRecords();
      for (const v of seed.vessels) await this.storage.putVessel(v);
      for (const p of seed.plans) await this.storage.putPlan(p);
      all = seed;
    }
    for (const p of all.plans) this.plans.set(p.id, p);
    for (const v of all.vessels) this.vessels.set(v.id, v);
  }

  allPlans = (): PlanRecord[] => [...this.plans.values()];
  plan = (id: string): PlanRecord | undefined => this.plans.get(id);
  vessel = (id: string): VesselRecord | undefined => this.vessels.get(id);
  allVessels = (): VesselRecord[] => [...this.vessels.values()];

  async put(record: PlanRecord): Promise<void> {
    this.plans.set(record.id, record);
    this.cache.delete(record.id);
    await this.storage.putPlan(record);
  }

  /** Every container of a plan with data: placed and on the load list. */
  private containersOf(rec: PlanRecord): Container[] {
    const d = rec.data!;
    const byId = new Map<string, Container>();
    for (const c of [...d.containers, ...d.loadList]) byId.set(c.id, c);
    return [...byId.values()];
  }

  computed(rec: PlanRecord): Computed {
    return this.entry(rec).computed;
  }

  summary(rec: PlanRecord): PlanSummary {
    return this.entry(rec).summary;
  }

  private entry(rec: PlanRecord): { computed: Computed; summary: PlanSummary } {
    const hit = this.cache.get(rec.id);
    if (hit) return hit;
    const base = {
      id: rec.id,
      vesselId: rec.vesselId,
      vessel: rec.vessel,
      teu: rec.teu,
      imo: rec.imo,
      voyage: rec.voyage,
      port: rec.port,
      etd: rec.etd,
      status: rec.status,
      version: rec.version,
      planner: rec.planner,
      updatedAt: rec.updatedAt,
    };
    if (!rec.data) {
      const f = rec.fixed!;
      const e = {
        computed: undefined as unknown as Computed,
        summary: {
          ...base,
          planned: f.planned,
          total: f.total,
          errors: f.errors,
          warnings: f.warnings,
          openable: false,
          preview: f.preview,
        },
      };
      this.cache.set(rec.id, e);
      return e;
    }
    const vessel = this.vessels.get(rec.vesselId)!;
    const ctx = createStowContext({
      vessel: vessel.vessel,
      containers: this.containersOf(rec),
      placements: rec.data.placements,
    });
    const state = createStowState(rec.data.placements, rec.data.shiftCount);
    const violations = validateAll(state, ctx);
    const L = ctx.vessel.limits;
    const r = computeStability(state, ctx, rec.data.stabilityBase);
    const errors = violations.filter((v) => v.severity === 'error');
    const byRule = RULE_ORDER.flatMap((rule) => {
      const hits = violations.filter((v) => v.rule === rule);
      if (!hits.length) return [];
      // One per violation, as the design's "Overstow 2" (the restow moves are on the timeline).
      return [{ label: RULE_TITLES[rule], severity: hits[0]!.severity, count: hits.length }];
    });
    const preview: PlanPreview = {
      bayFill: bayOccupancy(state, ctx).map((b) => ({
        deck: b.deck / b.deckCapacity,
        hold: b.hold / b.holdCapacity,
      })),
      errorBays: [...new Set(errors.map((v) => ctx.vessel.bays.findIndex((b) => b.bay === v.bay)))],
      stability: {
        gm: r.gm,
        trim: r.trim,
        list: r.list,
        gmState: gaugeState('gm', r.gm, L),
        trimState: gaugeState('trim', r.trim, L),
        listState: gaugeState('list', r.list, L),
      },
      violationsByRule: byRule,
    };
    const planned = rec.data.loadList.reduce((n, c) => n + (state.slotOf.has(c.id) ? 1 : 0), 0);
    const summary: PlanSummary = {
      ...base,
      planned,
      total: rec.data.loadList.length,
      errors: errors.length,
      warnings: violations.length - errors.length,
      openable: true,
      preview,
    };
    const e = { computed: { ctx, state, violations }, summary };
    this.cache.set(rec.id, e);
    return e;
  }
}
