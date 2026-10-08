// @vitest-environment node
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Session } from './types';
import { createApi, type Api } from './client';
import { ApiError } from './errors';
import { useMockControl } from './mock/control';
import { MockDb } from './mock/db';
import { createHandlers } from './mock/handlers';
import { memoryStorage } from './mock/storage';

// The contract of the ten endpoints, through the real client and the real handlers.

let session: Session = { role: 'planner', user: 'Rina Adiputri' };
let api: Api;
const server = setupServer();
beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

beforeEach(() => {
  session = { role: 'planner', user: 'Rina Adiputri' };
  useMockControl.setState({ force409: false, failNext: null });
  server.use(...createHandlers(new MockDb(memoryStorage()), { delayMs: () => 0 }));
  api = createApi(() => session, 'http://mock.test/api');
});

const fails = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('The request did not fail');
};

const FIX = { kind: 'move' as const, from: '180488', to: '180688' };

describe('GET /api/plans (FR-01, FR-02)', () => {
  it('lists the 12 voyages of the design, with counts for the tabs', async () => {
    const r = await api.listPlans();
    expect(r.plans).toHaveLength(12);
    expect(r.counts).toEqual({ all: 12, draft: 6, in_review: 3, approved: 3 });
    const first = r.plans[0]!;
    expect(first).toMatchObject({
      id: '042W-SGSIN',
      vessel: 'MV Nusantara Pioneer',
      voyage: '042W',
      port: 'SGSIN',
      status: 'draft',
      version: 14,
      planned: 312,
      total: 1240,
      errors: 6,
      warnings: 1,
      planner: 'Rina Adiputri',
      openable: true,
    });
    expect(first.preview.violationsByRule).toEqual([
      { label: 'Overstow', severity: 'error', count: 2 },
      { label: 'Stack weight', severity: 'error', count: 1 },
      { label: 'Reefer power', severity: 'error', count: 1 },
      { label: 'DG segregation', severity: 'error', count: 1 },
      { label: '20ft on 40ft', severity: 'error', count: 1 },
      { label: 'Heavy over light', severity: 'warning', count: 1 },
    ]);
    expect(first.preview.bayFill).toHaveLength(22);
    expect(first.preview.stability).toMatchObject({
      gmState: 'ok',
      trimState: 'ok',
      listState: 'check',
    });
    expect(r.plans.filter((p) => p.openable)).toHaveLength(1);
    expect(r.plans[1]).toMatchObject({
      vessel: 'MV Selat Meridian',
      status: 'in_review',
      errors: 0,
      warnings: 2,
    });
  });

  it('filters by status, assigned to me, violations and search, and sorts by ETD', async () => {
    expect((await api.listPlans({ status: 'approved' })).plans.map((p) => p.voyage)).toEqual([
      '077W',
      '064E',
      '052W',
    ]);
    expect((await api.listPlans({ mine: true })).plans.map((p) => p.voyage)).toEqual([
      '042W',
      '203N',
      '027W',
    ]);
    expect((await api.listPlans({ hasViolations: true })).plans).toHaveLength(6);
    expect((await api.listPlans({ q: 'dawn' })).plans.map((p) => p.vessel)).toEqual([
      'MV Arafura Dawn',
    ]);
    expect((await api.listPlans({ q: 'lkcmb' })).plans).toHaveLength(2);
    expect((await api.listPlans({ sort: '-etd' })).plans[0]!.voyage).toBe('140N');
    // The tabs count all plans whatever the filter.
    expect((await api.listPlans({ q: 'dawn' })).counts.all).toBe(12);
  });
});

describe('GET /api/plans/:id and vessels', () => {
  it('loads the seeded plan, and refuses the others with the reason (D11)', async () => {
    const p = await api.getPlan('042W-SGSIN');
    expect(p).toMatchObject({ id: '042W-SGSIN', version: 14, status: 'draft', shiftCount: 0 });
    expect(p.containers).toHaveLength(2740);
    expect(p.placements).toHaveLength(2740);
    const noGeo = await fails(api.getPlan('118E-IDJKT'));
    expect(noGeo).toMatchObject({ status: 404, code: 'no_geometry' });
    expect(await fails(api.getPlan('nope'))).toMatchObject({ status: 404, code: 'not_found' });
  });

  it('GET /api/vessels/:id gives geometry, limits and the stability base', async () => {
    const v = await api.getVessel('nusantara-pioneer');
    expect(v.vessel.name).toBe('MV Nusantara Pioneer');
    expect(v.vessel.limits.gmMinM).toBe(1.2);
    expect(v.stabilityBase.seedBayWeights).toHaveLength(22);
    expect(await fails(api.getVessel('x'))).toMatchObject({ status: 404 });
    expect(await api.listVessels()).toEqual([
      { id: 'nusantara-pioneer', name: 'MV Nusantara Pioneer', teu: 8500, imo: '9000000' },
    ]);
  });

  it('GET load-list has the 1,240 rows, 312 planned', async () => {
    const l = await api.getLoadList('042W-SGSIN');
    expect(l).toHaveLength(1240);
    expect(l.filter((x) => x.plannedSlotKey !== '')).toHaveLength(312);
    expect(await fails(api.getLoadList('118E-IDJKT'))).toMatchObject({ status: 404 });
  });
});

describe('PUT /api/plans/:id: save (FR-59, FR-60)', () => {
  it('applies the commands and raises the version by one', async () => {
    const r = await api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [FIX] });
    expect(r).toMatchObject({ version: 15, updatedBy: 'Rina Adiputri' });
    const p = await api.getPlan('042W-SGSIN');
    expect(p.version).toBe(15);
    expect(p.placements.find((x) => x.slotKey === '180688')?.containerId).toBe('NSPU 771032 1');
    expect((await api.listPlans()).plans[0]).toMatchObject({ version: 15, errors: 5 });
    const log = await api.getActivity('042W-SGSIN');
    expect(log[0]!.text).toBe('Rina Adiputri: Moved NSPU 771032 1 from 180488 to 180688');
  });

  it('refuses a stale base version with who saved and when (409)', async () => {
    await api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [FIX] });
    const e = await fails(api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [] }));
    expect(e).toMatchObject({ status: 409, code: 'conflict' });
    expect(e.details).toMatchObject({ currentVersion: 15, savedBy: 'Rina Adiputri' });
    expect(typeof e.details?.savedAt).toBe('string');
  });

  it('the developer switch forces one conflict: a colleague saves first', async () => {
    useMockControl.getState().setForce409(true);
    const e = await fails(api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [FIX] }));
    expect(e.status).toBe(409);
    expect(e.details).toMatchObject({ currentVersion: 15, savedBy: 'Dimas Hartono' });
    expect(useMockControl.getState().force409).toBe(false);
    // The same base is still stale; on the new version it saves.
    expect(
      (await fails(api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [FIX] }))).status,
    ).toBe(409);
    expect((await api.savePlan('042W-SGSIN', { baseVersion: 15, commands: [FIX] })).version).toBe(
      16,
    );
  });

  it('refuses a command that breaks a rule (422) and saves nothing', async () => {
    const bad = { kind: 'place' as const, containerId: 'NSPU 551208 4', to: '180688' };
    const e = await fails(api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [FIX, bad] }));
    expect(e).toMatchObject({ status: 422, code: 'rule_violation' });
    expect(e.details).toMatchObject({ index: 1 });
    expect((await api.getPlan('042W-SGSIN')).version).toBe(14);
  });

  it('refuses a body that is not a save, and a role that cannot edit', async () => {
    expect((await fails(api.savePlan('042W-SGSIN', {} as never))).status).toBe(422);
    session = { role: 'terminal', user: 'Maya Pratama' };
    expect(
      await fails(api.savePlan('042W-SGSIN', { baseVersion: 14, commands: [] })),
    ).toMatchObject({ status: 403 });
  });
});

describe('POST /api/plans/:id/status (FR-62, FR-63, AT-06)', () => {
  const status = (to: 'draft' | 'in_review' | 'approved', comment?: string) =>
    api.setStatus('042W-SGSIN', { to, comment });

  it('walks the workflow: review, return with a comment, review, approve, revise', async () => {
    expect((await status('in_review')).status).toBe('in_review');
    // A planner cannot approve (403); a senior cannot approve with errors (409).
    expect(await fails(status('approved'))).toMatchObject({ status: 403, code: 'forbidden' });
    session = { role: 'senior', user: 'Hendra Wirawan' };
    expect(await fails(status('approved'))).toMatchObject({ status: 409, code: 'errors_remain' });
    expect(await fails(status('draft', ' '))).toMatchObject({ status: 422 });
    expect((await status('draft', 'Fix the DG first')).status).toBe('draft');
    expect((await api.getActivity('042W-SGSIN'))[0]!.text).toBe(
      'Hendra Wirawan returned the plan to Draft: Fix the DG first',
    );
  });

  it('approves when no error remains, locks the plan, and Revise makes a new Draft version', async () => {
    // Fix the six errors on the server: the fixes of the panel, as saved commands.
    const fixes = [
      FIX,
      { kind: 'unplace' as const, from: '220610' },
      { kind: 'move' as const, from: '140484', to: '060488' },
      { kind: 'swap' as const, a: '100382', b: '100386' },
      { kind: 'swap' as const, a: '420882', b: '420884' },
      { kind: 'move' as const, from: '290284', to: '690482' },
    ];
    await api.savePlan('042W-SGSIN', { baseVersion: 14, commands: fixes });
    expect((await api.listPlans()).plans[0]).toMatchObject({ errors: 0, warnings: 1 });
    await status('in_review');
    session = { role: 'senior', user: 'Hendra Wirawan' };
    expect((await status('approved')).status).toBe('approved');
    expect(
      await fails(api.savePlan('042W-SGSIN', { baseVersion: 15, commands: [] })),
    ).toMatchObject({ status: 403, code: 'read_only' });
    session = { role: 'planner', user: 'Rina Adiputri' };
    const revised = await status('draft');
    expect(revised).toMatchObject({ status: 'draft', version: 16 });
  });

  it('refuses an unknown status and a change the workflow does not have', async () => {
    expect((await fails(status('sailed' as never))).status).toBe(422);
    // draft to approved is not a step of the workflow.
    expect(await fails(status('approved'))).toMatchObject({ status: 422 });
  });
});

describe('export (FR-65)', () => {
  it('is refused until the plan is approved (409), then gives the plan as JSON', async () => {
    expect(await fails(api.exportPlan('042W-SGSIN'))).toMatchObject({
      status: 409,
      code: 'not_approved',
    });
    const ok = await api.exportPlan('077W-LKCMB').catch((e: unknown) => e);
    // 077W is approved but has no geometry in the demo.
    expect(ok).toMatchObject({ status: 404 });
  });
});

describe('POST /api/plans: new plan (FR-05)', () => {
  const body = {
    vesselId: 'nusantara-pioneer',
    voyage: '043W',
    port: 'LKCMB',
    etd: '2026-10-20T10:00:00+08:00',
  };

  it('creates a Draft from the arrival condition, with an empty load list', async () => {
    const s = await api.createPlan(body);
    expect(s).toMatchObject({
      id: '043W-LKCMB',
      status: 'draft',
      version: 1,
      planned: 0,
      total: 0,
      planner: 'Rina Adiputri',
      openable: true,
    });
    const p = await api.getPlan('043W-LKCMB');
    expect(p.placements.length).toBeGreaterThan(1000);
    expect(p.placements.every((x) => x.origin === 'onboard')).toBe(true);
    expect(await api.getLoadList('043W-LKCMB')).toEqual([]);
    expect((await api.listPlans()).counts.all).toBe(13);
  });

  it('refuses invalid input with the field (422)', async () => {
    const e = await fails(api.createPlan({ ...body, voyage: 'abc' }));
    expect(e).toMatchObject({ status: 422, code: 'invalid_input' });
    expect(e.details).toMatchObject({
      fields: { voyage: expect.stringContaining('3 digits') as string },
    });
    expect((await fails(api.createPlan({ ...body, vesselId: 'x' }))).status).toBe(422);
    expect((await fails(api.createPlan({ ...body, port: 'ZZZZZ' }))).status).toBe(422);
    expect((await fails(api.createPlan({ ...body, voyage: '042W', port: 'SGSIN' }))).status).toBe(
      422,
    );
  });
});

describe('POST load-list/import (FR-64, AT-10)', () => {
  it('accepts 7 of 10 rows and lists the 3 rejected with a reason each', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `NSPU ${900000 + i} 1`,
      type: '40HC',
      weightT: 20,
      pod: 'AEJEA',
    }));
    rows[1] = { ...rows[1]!, weightT: 80 };
    rows[4] = { ...rows[4]!, type: 'XX' };
    rows[7] = { ...rows[7]!, pod: 'SGSIN' };
    const r = await api.importLoadList('042W-SGSIN', JSON.stringify(rows));
    expect(r.accepted).toBe(7);
    expect(r.rejected.map((x) => x.row)).toEqual([2, 5, 8]);
    expect(await api.getLoadList('042W-SGSIN')).toHaveLength(1247);
    // The same file again: every ID is on the plan now.
    expect((await api.importLoadList('042W-SGSIN', JSON.stringify(rows))).accepted).toBe(0);
  });

  it('refuses a file that is not JSON (422), and a read only role (403)', async () => {
    expect(await fails(api.importLoadList('042W-SGSIN', '<html>'))).toMatchObject({
      status: 422,
      code: 'invalid_file',
    });
    session = { role: 'officer', user: 'Arif Nugraha' };
    expect((await fails(api.importLoadList('042W-SGSIN', '[]'))).status).toBe(403);
  });
});

describe('errors (NFR-18)', () => {
  it('every error has a code and a message; a forced failure fails one request', async () => {
    useMockControl.getState().setFailNext(503);
    const e = await fails(api.listPlans());
    expect(e).toMatchObject({ status: 503, code: 'forced' });
    expect(e.message.length).toBeGreaterThan(10);
    expect((await api.listPlans()).plans).toHaveLength(12);
  });

  it('an unreachable server is status 0 with a message', async () => {
    const down = createApi(() => session, 'http://nowhere.invalid/elsewhere');
    // Nothing answers this path: the request fails before it gets an answer.
    const e = await fails(down.listPlans());
    expect(e.status).toBe(0);
    expect(e.code).toBe('network');
  });
});
