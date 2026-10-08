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

/** Every path that can change a plan. Each one asks `canEdit` before it acts (M8). */
export const EDIT_ACTIONS = [
  'command',
  'drag',
  'pickUp',
  'applyFix',
  'import',
  'save',
  'undo',
  'redo',
  'revise',
] as const;

export type EditAction = (typeof EDIT_ACTIONS)[number];

export type Gate = { ok: true } | { ok: false; reason: string };

const NO_ROLE = 'Your role cannot change plans.';
const NO_APPROVED = 'This plan is approved and read only. Revise it to make changes.';
const NO_REVIEW = 'This plan is in review and read only until it is returned or approved.';
const NO_REVISE = 'Only an approved plan can be revised.';

/**
 * The one gate for every change to a plan (decisions 1, 2 and 4). A Draft can be changed by the
 * vessel planner and the senior planner. In review and Approved are locked for every role; an
 * approved plan says so first, whoever looks. Revise is the one action on an approved plan.
 */
export function canEdit(plan: { status: PlanStatus }, role: Role, action: EditAction): Gate {
  const editor = roleInfo(role).canEdit;
  if (action === 'revise') {
    if (plan.status !== 'approved') return { ok: false, reason: NO_REVISE };
    return editor ? { ok: true } : { ok: false, reason: NO_ROLE };
  }
  if (plan.status === 'approved') return { ok: false, reason: NO_APPROVED };
  if (plan.status === 'in_review') return { ok: false, reason: NO_REVIEW };
  return editor ? { ok: true } : { ok: false, reason: NO_ROLE };
}

const remain = (errors: number): string =>
  errors === 1
    ? '1 error remains. Return the plan to fix it.'
    : `${errors} errors remain. Return the plan to fix them.`;

/** What a role may do with a plan in its status: the design's status × role table (M6). */
export interface PlanActions {
  send: boolean;
  ret: boolean;
  /** Not offered, blocked with its reason while errors remain (decision 3), or ready. */
  approve: { state: 'hidden' | 'blocked' | 'ready'; reason: string | null };
  revise: boolean;
  export: boolean;
  /** The primary button in the top bar (design 10): Save on a Draft, the decision in review. */
  primary: 'save' | 'approve' | 'revise';
  /** The note under the preview buttons (design 15), or null. */
  note: string | null;
}

export function planActions(
  plan: { status: PlanStatus; errors: number; openable?: boolean },
  role: Role,
): PlanActions {
  const { status, errors } = plan;
  const openable = plan.openable ?? true;
  const editor = roleInfo(role).canEdit;
  const senior = role === 'senior';
  const approve: PlanActions['approve'] =
    senior && status === 'in_review'
      ? errors > 0
        ? { state: 'blocked', reason: remain(errors) }
        : { state: 'ready', reason: null }
      : { state: 'hidden', reason: null };
  const note =
    approve.state === 'blocked'
      ? approve.reason
      : !openable
        ? null
        : !editor
          ? 'Opens read only'
          : status === 'in_review' && !senior
            ? 'Opens read only until returned'
            : null;
  return {
    send: editor && status === 'draft',
    ret: senior && status === 'in_review',
    approve,
    revise: canEdit(plan, role, 'revise').ok,
    export: status === 'approved' && openable,
    primary: status === 'draft' ? 'save' : status === 'in_review' ? 'approve' : 'revise',
    note,
  };
}

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
    // Allowed with errors (decision 4): the senior planner sees them and returns the plan.
    return roleInfo(role).canEdit
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
    if (role !== 'senior')
      return { ok: false, status: 403, message: 'Only a senior planner can return a plan.' };
    return comment.trim() === ''
      ? { ok: false, status: 422, message: 'A comment is required when a plan is returned.' }
      : { ok: true };
  }
  if (from === 'approved' && to === 'draft') {
    return canEdit({ status: from }, role, 'revise').ok
      ? { ok: true }
      : { ok: false, status: 403, message: 'Your role cannot revise this plan.' };
  }
  return { ok: false, status: 422, message: `A plan cannot go from ${from} to ${to}.` };
}
