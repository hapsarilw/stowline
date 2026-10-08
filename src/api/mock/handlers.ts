import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import {
  applyCommand,
  createStowState,
  parseLoadListFile,
  plural,
  ROLES,
  ROTATION,
  roleInfo,
  toPlacements,
  transition,
  type PlanStatus,
  type Role,
} from '@/domain';
import { activityText } from '@/state/messages';
import type {
  ActivityEntry,
  ErrorBody,
  NewPlanRequest,
  PlanDetail,
  SaveRequest,
  StatusRequest,
} from '../types';
import { takeFailure, takeForce409 } from './control';
import type { MockDb } from './db';
import type { PlanRecord } from './storage';

// The ten endpoints (SRS "Interfaces"), answered in the browser by Mock Service Worker. Every
// request waits 150 to 400 ms. Errors have one shape: a code, a message and optional details.

const fail = (status: number, code: string, message: string, details?: Record<string, unknown>) =>
  HttpResponse.json<ErrorBody>({ code, message, ...(details ? { details } : {}) }, { status });

const who = (req: Request): { role: Role; user: string } => {
  const r = req.headers.get('X-Role');
  const role = ROLES.find((x) => x.id === r)?.id ?? 'planner';
  return { role, user: req.headers.get('X-User') ?? roleInfo(role).user };
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const now = () => new Date().toISOString();

const NO_GEOMETRY = (id: string) =>
  fail(
    404,
    'no_geometry',
    `Plan ${id} has no vessel geometry in this demo, so it cannot be opened.`,
  );
const NOT_FOUND = (id: string) => fail(404, 'not_found', `There is no plan with the id ${id}.`);

export interface HandlerOptions {
  /** Milliseconds each request waits. The browser uses 150 to 400. */
  delayMs?: () => number;
}

export function createHandlers(db: MockDb, options: HandlerOptions = {}): HttpHandler[] {
  const wait = options.delayMs ?? (() => 150 + Math.random() * 250);

  /** Waits, then answers with a forced failure when the developer switch asks for one. */
  const gate = async (): Promise<Response | null> => {
    await db.ready;
    const ms = wait();
    if (ms > 0) await delay(ms);
    const status = takeFailure();
    return status
      ? fail(
          status,
          'forced',
          `The server failed on purpose (${status}), from the developer switch.`,
        )
      : null;
  };

  const log = (rec: PlanRecord, user: string, text: string): void => {
    rec.activity = [{ at: now(), user, text }, ...rec.activity].slice(0, 200);
  };

  return [
    http.get('*/api/plans', async ({ request }) => {
      const failed = await gate();
      if (failed) return failed;
      const url = new URL(request.url);
      const { user } = who(request);
      const status = url.searchParams.get('status');
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const all = db.allPlans().map((r) => db.summary(r));
      const sorted = [...all].sort((a, b) => a.etd.localeCompare(b.etd));
      if (url.searchParams.get('sort') === '-etd') sorted.reverse();
      const plans = sorted.filter(
        (p) =>
          (!status || p.status === status) &&
          (url.searchParams.get('mine') !== 'true' || p.planner === user) &&
          (url.searchParams.get('hasViolations') !== 'true' || p.errors + p.warnings > 0) &&
          (!q || `${p.vessel} ${p.voyage} ${p.port}`.toLowerCase().includes(q)),
      );
      const count = (s: PlanStatus) => all.filter((p) => p.status === s).length;
      return HttpResponse.json({
        plans,
        counts: {
          all: all.length,
          draft: count('draft'),
          in_review: count('in_review'),
          approved: count('approved'),
        },
      });
    }),

    http.post('*/api/plans', async ({ request }) => {
      const failed = await gate();
      if (failed) return failed;
      const { user } = who(request);
      let body: Partial<NewPlanRequest>;
      try {
        body = (await request.json()) as Partial<NewPlanRequest>;
      } catch {
        return fail(422, 'invalid_input', 'The request is not valid JSON.');
      }
      const fields: Record<string, string> = {};
      const vessel = typeof body.vesselId === 'string' ? db.vessel(body.vesselId) : undefined;
      if (!vessel) fields.vesselId = 'Choose a vessel.';
      if (typeof body.voyage !== 'string' || !/^\d{3}[NSEW]$/.test(body.voyage))
        fields.voyage = 'A voyage is 3 digits and a direction, like 043W.';
      if (typeof body.port !== 'string' || !ROTATION.some((p) => p.code === body.port))
        fields.port = 'Choose a port from the rotation.';
      if (typeof body.etd !== 'string' || Number.isNaN(Date.parse(body.etd)))
        fields.etd = 'Give the departure as a date and time.';
      if (Object.keys(fields).length || !vessel)
        return fail(422, 'invalid_input', Object.values(fields)[0] ?? 'The plan is not valid.', {
          fields,
        });
      const id = `${body.voyage}-${body.port}`;
      if (db.plan(id))
        return fail(422, 'invalid_input', `Plan ${id} already exists.`, {
          fields: { voyage: 'This voyage already has a plan at this port.' },
        });
      const rec: PlanRecord = {
        id,
        vesselId: vessel.id,
        vessel: vessel.vessel.name,
        teu: vessel.vessel.teu,
        imo: vessel.vessel.imo,
        voyage: body.voyage!,
        port: body.port!,
        etd: body.etd!,
        status: 'draft',
        version: 1,
        planner: user,
        updatedAt: now(),
        updatedBy: user,
        activity: [
          {
            at: now(),
            user,
            text: `${user} created the plan from the ${vessel.vessel.name} arrival condition`,
          },
        ],
        data: {
          placements: structuredClone(vessel.arrival.placements),
          shiftCount: 0,
          containers: structuredClone(vessel.arrival.containers),
          loadList: [],
          stabilityBase: vessel.stabilityBase,
        },
        fixed: null,
      };
      await db.put(rec);
      return HttpResponse.json(db.summary(rec), { status: 201 });
    }),

    http.get('*/api/plans/:id', async ({ params }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      if (!rec.data) return NO_GEOMETRY(id);
      const detail: PlanDetail = {
        id: rec.id,
        vesselId: rec.vesselId,
        voyage: rec.voyage,
        port: rec.port,
        etd: rec.etd,
        status: rec.status,
        version: rec.version,
        placements: rec.data.placements,
        plannerId: slug(rec.planner ?? 'unassigned'),
        shiftCount: rec.data.shiftCount,
        containers: rec.data.containers,
        stabilityBase: rec.data.stabilityBase,
        updatedAt: rec.updatedAt ?? now(),
        updatedBy: rec.updatedBy ?? 'Unassigned',
      };
      return HttpResponse.json(detail);
    }),

    http.put('*/api/plans/:id', async ({ params, request }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      if (!rec.data) return NO_GEOMETRY(id);
      const { role, user } = who(request);
      let body: Partial<SaveRequest>;
      try {
        body = (await request.json()) as Partial<SaveRequest>;
      } catch {
        return fail(422, 'invalid_input', 'The request is not valid JSON.');
      }
      if (typeof body.baseVersion !== 'number' || !Array.isArray(body.commands))
        return fail(422, 'invalid_input', 'A save needs a base version and a list of commands.');
      if (!roleInfo(role).canEdit || rec.status === 'approved')
        return fail(
          403,
          'read_only',
          rec.status === 'approved'
            ? 'An approved plan is read only. Revise it to make changes.'
            : 'Your role cannot change plans.',
        );

      // A conflict: a newer version exists. The developer switch makes one happen: a colleague
      // saves first, then this save is refused (SRS "Mock behavior").
      if (takeForce409()) {
        rec.version += 1;
        rec.updatedAt = now();
        rec.updatedBy = 'Dimas Hartono';
        log(rec, 'Dimas Hartono', 'Dimas Hartono updated the plan');
        await db.put(rec);
      }
      if (body.baseVersion !== rec.version) {
        return fail(
          409,
          'conflict',
          `${rec.updatedBy ?? 'Someone'} saved version ${rec.version} first.`,
          {
            currentVersion: rec.version,
            savedBy: rec.updatedBy ?? 'Someone',
            savedAt: rec.updatedAt ?? now(),
          },
        );
      }

      const { ctx } = db.computed(rec);
      let state = createStowState(rec.data.placements, rec.data.shiftCount);
      const texts: string[] = [];
      for (const [i, cmd] of body.commands.entries()) {
        const r = applyCommand(state, ctx, cmd);
        if (!r.ok)
          return fail(422, 'rule_violation', `Change ${i + 1} breaks a rule: ${r.reason}.`, {
            index: i,
            reason: r.reason,
          });
        texts.push(activityText(cmd, state));
        state = r.state;
      }
      rec.data.placements = toPlacements(state);
      rec.data.shiftCount = state.shiftCount;
      rec.version += 1;
      rec.updatedAt = now();
      rec.updatedBy = user;
      for (const t of texts) log(rec, user, `${user}: ${t}`);
      if (texts.length === 0) log(rec, user, `${user} saved version ${rec.version}`);
      await db.put(rec);
      return HttpResponse.json({ version: rec.version, updatedAt: rec.updatedAt, updatedBy: user });
    }),

    http.post('*/api/plans/:id/status', async ({ params, request }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      const { role, user } = who(request);
      let body: Partial<StatusRequest>;
      try {
        body = (await request.json()) as Partial<StatusRequest>;
      } catch {
        return fail(422, 'invalid_input', 'The request is not valid JSON.');
      }
      if (body.to !== 'draft' && body.to !== 'in_review' && body.to !== 'approved')
        return fail(422, 'invalid_input', 'The new status must be draft, in_review or approved.');
      const errors = db.summary(rec).errors;
      const t = transition(role, rec.status, body.to, errors, body.comment ?? '');
      if (!t.ok)
        return fail(
          t.status,
          t.status === 403 ? 'forbidden' : t.status === 409 ? 'errors_remain' : 'invalid_input',
          t.message,
        );

      const from = rec.status;
      rec.status = body.to;
      if (from === 'approved' && body.to === 'draft') rec.version += 1; // Revise: a new Draft version
      rec.updatedAt = now();
      rec.updatedBy = user;
      const text =
        body.to === 'in_review'
          ? `${user} sent the plan for review`
          : body.to === 'approved'
            ? `${user} approved the plan`
            : from === 'approved'
              ? `${user} revised the plan: version ${rec.version} is a new Draft`
              : `${user} returned the plan to Draft: ${(body.comment ?? '').trim()}`;
      log(rec, user, text);
      await db.put(rec);
      return HttpResponse.json(db.summary(rec));
    }),

    http.get('*/api/plans/:id/load-list', async ({ params }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      if (!rec.data) return NO_GEOMETRY(id);
      const slotOf = new Map(rec.data.placements.map((p) => [p.containerId, p.slotKey]));
      return HttpResponse.json(
        rec.data.loadList.map((container) => ({
          container,
          plannedSlotKey: slotOf.get(container.id) ?? '',
        })),
      );
    }),

    http.post('*/api/plans/:id/load-list/import', async ({ params, request }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      if (!rec.data) return NO_GEOMETRY(id);
      const { role, user } = who(request);
      if (!roleInfo(role).canEdit || rec.status === 'approved')
        return fail(403, 'read_only', 'This plan is read only, so a load list cannot be imported.');
      const text = await request.text();
      const existing = new Set([...rec.data.containers, ...rec.data.loadList].map((c) => c.id));
      const r = parseLoadListFile(text, { port: rec.port, existingIds: existing });
      if (!r.ok) return fail(422, 'invalid_file', r.message);
      rec.data.loadList = [...rec.data.loadList, ...r.accepted];
      rec.updatedAt = now();
      log(
        rec,
        user,
        `${user} imported a load list: ${plural(r.accepted.length, 'row')} accepted, ${r.rejected.length} rejected`,
      );
      await db.put(rec);
      return HttpResponse.json({ accepted: r.accepted.length, rejected: r.rejected });
    }),

    http.get('*/api/plans/:id/activity', async ({ params }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      const entries: ActivityEntry[] = rec.activity;
      return HttpResponse.json(entries);
    }),

    http.get('*/api/plans/:id/export', async ({ params }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const rec = db.plan(id);
      if (!rec) return NOT_FOUND(id);
      if (rec.status !== 'approved')
        return fail(409, 'not_approved', 'Only an approved plan can be exported.');
      if (!rec.data) return NO_GEOMETRY(id);
      const slotOf = new Map(rec.data.placements.map((p) => [p.containerId, p.slotKey]));
      const file = {
        schema: 'stowline.plan/1',
        plan: {
          id: rec.id,
          vesselId: rec.vesselId,
          voyage: rec.voyage,
          port: rec.port,
          etd: rec.etd,
          status: rec.status,
          version: rec.version,
          plannerId: slug(rec.planner ?? 'unassigned'),
          shiftCount: rec.data.shiftCount,
          placements: rec.data.placements,
        },
        containers: rec.data.containers,
        loadList: rec.data.loadList.map((container) => ({
          container,
          plannedSlotKey: slotOf.get(container.id) ?? '',
        })),
      };
      return new HttpResponse(JSON.stringify(file, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="stowline-plan-${rec.id}.json"`,
        },
      });
    }),

    http.get('*/api/vessels', async () => {
      const failed = await gate();
      if (failed) return failed;
      return HttpResponse.json(
        db
          .allVessels()
          .map((v) => ({ id: v.id, name: v.vessel.name, teu: v.vessel.teu, imo: v.vessel.imo })),
      );
    }),

    http.get('*/api/vessels/:id', async ({ params }) => {
      const failed = await gate();
      if (failed) return failed;
      const id = String(params.id);
      const v = db.vessel(id);
      return v
        ? HttpResponse.json({ vessel: v.vessel, stabilityBase: v.stabilityBase })
        : fail(404, 'not_found', `There is no vessel with the id ${id}.`);
    }),
  ];
}
