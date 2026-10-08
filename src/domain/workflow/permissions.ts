import type { PlanStatus } from '../types';

// Roles and the plan workflow (FR-62, FR-63, PRD process steps 9 to 11). Pure, so the mock API
// and the screens apply the same rules.

export type Role = 'planner' | 'senior' | 'terminal' | 'officer';

export interface RoleInfo {
  id: Role;
  label: string;
  /** The fictional person signed in with this role. */
  user: string;
  initials: string;
  canEdit: boolean;
}

export const ROLES: readonly RoleInfo[] = [
  { id: 'planner', label: 'Vessel planner', user: 'Rina Adiputri', initials: 'RA', canEdit: true },
  { id: 'senior', label: 'Senior planner', user: 'Hendra Wirawan', initials: 'HW', canEdit: true },
  {
    id: 'terminal',
    label: 'Terminal planner',
    user: 'Maya Pratama',
    initials: 'MP',
    canEdit: false,
  },
  { id: 'officer', label: 'Chief officer', user: 'Arif Nugraha', initials: 'AN', canEdit: false },
];

export const roleInfo = (role: Role): RoleInfo => ROLES.find((r) => r.id === role)!;

/**
 * Approved plans are read only (FR-63). A plan in review is locked too, as design 10 and 11
 * draw it: the decision is the senior planner's, and a change means a Return first. Roles
 * without editing are always read only.
 */
export const canEditPlan = (role: Role, status: PlanStatus): boolean =>
  roleInfo(role).canEdit && status === 'draft';

/** Why a plan cannot be changed, in the words of design 11, or null when it can. */
export function readOnlyReason(role: Role, status: PlanStatus): string | null {
  if (canEditPlan(role, status)) return null;
  if (status === 'approved')
    return 'This plan is approved and read only. Revise it to make changes.';
  if (status === 'in_review')
    return 'This plan is in review and read only until it is returned or approved.';
  return 'Your role cannot change plans.';
}

export const canSendForReview = (role: Role, status: PlanStatus): boolean =>
  roleInfo(role).canEdit && status === 'draft';

/** Not offered to anyone but the senior planner, then disabled while errors remain (AT-06). */
export function approveState(
  role: Role,
  status: PlanStatus,
  errors: number,
): 'hidden' | 'disabled' | 'enabled' {
  if (role !== 'senior' || status !== 'in_review') return 'hidden';
  return errors > 0 ? 'disabled' : 'enabled';
}

export const canReturn = (role: Role, status: PlanStatus): boolean =>
  role === 'senior' && status === 'in_review';

export const canRevise = (role: Role, status: PlanStatus): boolean =>
  roleInfo(role).canEdit && status === 'approved';

export const canExport = (_role: Role, status: PlanStatus): boolean => status === 'approved';

export type TransitionResult =
  { ok: true } | { ok: false; status: 403 | 409 | 422; message: string };

/** A status change, as the server decides it. */
export function transition(
  role: Role,
  from: PlanStatus,
  to: PlanStatus,
  errors: number,
  comment: string,
): TransitionResult {
  if (from === 'draft' && to === 'in_review') {
    return canSendForReview(role, from)
      ? { ok: true }
      : { ok: false, status: 403, message: 'Your role cannot send this plan for review.' };
  }
  if (from === 'in_review' && to === 'approved') {
    if (role !== 'senior')
      return { ok: false, status: 403, message: 'Only a senior planner can approve a plan.' };
    return errors > 0
      ? {
          ok: false,
          status: 409,
          message: `The plan cannot be approved while ${errors === 1 ? '1 error remains' : `${errors} errors remain`}.`,
        }
      : { ok: true };
  }
  if (from === 'in_review' && to === 'draft') {
    if (!canReturn(role, from))
      return { ok: false, status: 403, message: 'Only a senior planner can return a plan.' };
    return comment.trim() === ''
      ? { ok: false, status: 422, message: 'A comment is required when a plan is returned.' }
      : { ok: true };
  }
  if (from === 'approved' && to === 'draft') {
    return canRevise(role, from)
      ? { ok: true }
      : { ok: false, status: 403, message: 'Your role cannot revise this plan.' };
  }
  return { ok: false, status: 422, message: `A plan cannot go from ${from} to ${to}.` };
}
