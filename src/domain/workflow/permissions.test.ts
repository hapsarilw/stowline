import { describe, expect, it } from 'vitest';
import type { PlanStatus } from '../types';
import { canEdit, EDIT_ACTIONS, planActions, ROLES, transition, type Role } from './permissions';

const ROLE_IDS: Role[] = ['planner', 'senior', 'terminal', 'officer'];
const STATUSES: PlanStatus[] = ['draft', 'in_review', 'approved'];

const ROLE_NO = 'Your role cannot change plans.';
const APPROVED_NO = 'This plan is approved and read only. Revise it to make changes.';
const REVIEW_NO = 'This plan is in review and read only until it is returned or approved.';
const REVISE_NO = 'Only an approved plan can be revised.';

describe('roles (decision 1)', () => {
  it('has the four roles, two of them read only', () => {
    expect(ROLES.map((r) => r.id)).toEqual(ROLE_IDS);
    expect(ROLES.filter((r) => !r.canEdit).map((r) => r.id)).toEqual(['terminal', 'officer']);
  });
});

describe('canEdit: 4 roles × 3 statuses × every edit action (decisions 1, 2, 4)', () => {
  /** What the design and decisions 1, 2 and 4 say, written out for each case. */
  function expected(role: Role, status: PlanStatus, action: string): string | null {
    const editor = role === 'planner' || role === 'senior';
    if (action === 'revise') {
      if (status !== 'approved') return REVISE_NO;
      return editor ? null : ROLE_NO;
    }
    if (status === 'approved') return APPROVED_NO;
    if (status === 'in_review') return REVIEW_NO;
    return editor ? null : ROLE_NO;
  }

  it('lists the nine edit paths', () => {
    expect(EDIT_ACTIONS).toEqual([
      'command',
      'drag',
      'pickUp',
      'applyFix',
      'import',
      'save',
      'undo',
      'redo',
      'revise',
    ]);
  });

  for (const role of ROLE_IDS)
    for (const status of STATUSES)
      for (const action of EDIT_ACTIONS)
        it(`${role} · ${status} · ${action}`, () => {
          const why = expected(role, status, action);
          expect(canEdit({ status }, role, action)).toEqual(
            why === null ? { ok: true } : { ok: false, reason: why },
          );
        });

  it('every "no" has a reason in words', () => {
    for (const role of ROLE_IDS)
      for (const status of STATUSES)
        for (const action of EDIT_ACTIONS) {
          const r = canEdit({ status }, role, action);
          if (!r.ok) expect(r.reason).toMatch(/^[A-Z].+\.$/);
        }
  });
});

describe('planActions: the design matrix, status × role (decisions 2, 3)', () => {
  const at = (status: PlanStatus, role: Role, errors = 0, openable = true) =>
    planActions({ status, errors, openable }, role);

  it('Draft: editors can send for review, even with errors; read-only roles open read only', () => {
    expect(at('draft', 'planner', 6)).toMatchObject({ send: true, primary: 'save', note: null });
    expect(at('draft', 'senior')).toMatchObject({ send: true, ret: false, revise: false });
    expect(at('draft', 'terminal')).toMatchObject({ send: false, note: 'Opens read only' });
    expect(at('draft', 'officer').approve.state).toBe('hidden');
  });

  it('In review: the senior planner returns or approves; Approve is blocked with errors', () => {
    expect(at('in_review', 'planner')).toMatchObject({
      send: false,
      ret: false,
      primary: 'approve',
      note: 'Opens read only until returned',
    });
    const senior = at('in_review', 'senior', 6);
    expect(senior.ret).toBe(true);
    expect(senior.approve).toEqual({
      state: 'blocked',
      reason: '6 errors remain. Return the plan to fix them.',
    });
    expect(senior.note).toBe('6 errors remain. Return the plan to fix them.');
    expect(at('in_review', 'senior', 1).approve.reason).toBe(
      '1 error remains. Return the plan to fix it.',
    );
    expect(at('in_review', 'senior', 0).approve).toEqual({ state: 'ready', reason: null });
    expect(at('in_review', 'terminal')).toMatchObject({ ret: false, note: 'Opens read only' });
  });

  it('Approved: editors revise and export; read-only roles export only', () => {
    expect(at('approved', 'planner')).toMatchObject({
      revise: true,
      export: true,
      primary: 'revise',
    });
    expect(at('approved', 'officer')).toMatchObject({ revise: false, export: true });
    // A plan with no vessel geometry has nothing to export (decision 8).
    expect(at('approved', 'planner', 0, false)).toMatchObject({ export: false, note: null });
  });
});

describe('transition, as the server decides it', () => {
  it('follows the workflow and says why it refuses', () => {
    expect(transition('planner', 'draft', 'in_review', 0, '')).toEqual({ ok: true });
    // Sending for review is allowed with errors (decision 4).
    expect(transition('planner', 'draft', 'in_review', 6, '')).toEqual({ ok: true });
    expect(transition('senior', 'in_review', 'approved', 0, '')).toEqual({ ok: true });
    expect(transition('senior', 'in_review', 'draft', 0, 'Fix the DG')).toEqual({ ok: true });
    expect(transition('planner', 'approved', 'draft', 0, '')).toEqual({ ok: true });
    expect(transition('planner', 'in_review', 'approved', 0, '')).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(transition('senior', 'in_review', 'approved', 3, '')).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(transition('senior', 'in_review', 'draft', 0, '  ')).toMatchObject({
      ok: false,
      status: 422,
      message: 'A comment is required when a plan is returned.',
    });
    expect(transition('senior', 'draft', 'approved', 0, '').ok).toBe(false);
    expect(transition('terminal', 'draft', 'in_review', 0, '')).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(transition('terminal', 'approved', 'draft', 0, '')).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});
