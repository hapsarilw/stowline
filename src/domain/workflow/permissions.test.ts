import { describe, expect, it } from 'vitest';
import {
  approveState,
  canEditPlan,
  canRevise,
  canReturn,
  canSendForReview,
  canExport,
  readOnlyReason,
  ROLES,
  transition,
} from './permissions';

describe('roles', () => {
  it('has the four roles, two of them read only', () => {
    expect(ROLES.map((r) => r.id)).toEqual(['planner', 'senior', 'terminal', 'officer']);
    expect(ROLES.filter((r) => !r.canEdit).map((r) => r.id)).toEqual(['terminal', 'officer']);
  });
});

describe('editing (FR-63)', () => {
  it('lets planner roles edit a draft only: a plan in review or approved is read only', () => {
    expect(canEditPlan('planner', 'draft')).toBe(true);
    expect(canEditPlan('senior', 'draft')).toBe(true);
    expect(canEditPlan('senior', 'in_review')).toBe(false);
    expect(canEditPlan('planner', 'approved')).toBe(false);
    expect(canEditPlan('terminal', 'draft')).toBe(false);
    expect(canEditPlan('officer', 'draft')).toBe(false);
  });
});

describe('why a plan is read only (design 11)', () => {
  it('says so in the words of the design', () => {
    expect(readOnlyReason('planner', 'draft')).toBeNull();
    expect(readOnlyReason('planner', 'approved')).toBe(
      'This plan is approved and read only. Revise it to make changes.',
    );
    expect(readOnlyReason('senior', 'in_review')).toBe(
      'This plan is in review and read only until it is returned or approved.',
    );
    expect(readOnlyReason('terminal', 'draft')).toBe('Your role cannot change plans.');
    // An approved plan says approved first, whoever looks.
    expect(readOnlyReason('terminal', 'approved')).toContain('approved');
  });
});

describe('send for review, approve, return, revise (FR-62, FR-63, AT-06)', () => {
  it('Send for review: planner roles, on a draft', () => {
    expect(canSendForReview('planner', 'draft')).toBe(true);
    expect(canSendForReview('planner', 'in_review')).toBe(false);
    expect(canSendForReview('terminal', 'draft')).toBe(false);
  });

  it('Approve is not offered to a planner, disabled with errors for a senior, enabled without', () => {
    expect(approveState('planner', 'in_review', 0)).toBe('hidden');
    expect(approveState('senior', 'in_review', 6)).toBe('disabled');
    expect(approveState('senior', 'in_review', 0)).toBe('enabled');
    expect(approveState('senior', 'draft', 0)).toBe('hidden');
    expect(approveState('senior', 'approved', 0)).toBe('hidden');
  });

  it('Return: senior, on a plan in review', () => {
    expect(canReturn('senior', 'in_review')).toBe(true);
    expect(canReturn('planner', 'in_review')).toBe(false);
    expect(canReturn('senior', 'draft')).toBe(false);
  });

  it('Revise: planner roles, on an approved plan', () => {
    expect(canRevise('planner', 'approved')).toBe(true);
    expect(canRevise('senior', 'approved')).toBe(true);
    expect(canRevise('terminal', 'approved')).toBe(false);
    expect(canRevise('planner', 'draft')).toBe(false);
  });

  it('Export: any role, on an approved plan', () => {
    expect(canExport('terminal', 'approved')).toBe(true);
    expect(canExport('terminal', 'draft')).toBe(false);
  });
});

describe('transition', () => {
  const ok = (r: ReturnType<typeof transition>) => r.ok;
  it('follows the workflow and says why it refuses', () => {
    expect(transition('planner', 'draft', 'in_review', 0, '')).toEqual({ ok: true });
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
    });
    expect(ok(transition('senior', 'draft', 'approved', 0, ''))).toBe(false);
    expect(transition('terminal', 'draft', 'in_review', 0, '')).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});
