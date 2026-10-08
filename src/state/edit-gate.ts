import {
  canEdit,
  planActions,
  type EditAction,
  type Gate,
  roleInfo,
  type PlanActions,
  type PlanStatus,
} from '@/domain';
import { usePlanStore } from './plan-store';
import { useSessionStore } from './session-store';

// The one place the screens and the stores ask whether a change is allowed (decisions 1, 2 and
// 4). Every edit path calls `editGate.check` with its action before it acts (through `allowed`
// in ./allowed when it should say why); components read the hooks below and hold no role or
// status check of their own. This module imports no view store: the plan store depends on it.

export const editGate = {
  /** Can the signed-in role take this action on the plan in the workspace now? */
  check(action: EditAction): Gate {
    return canEdit(usePlanStore.getState().header, useSessionStore.getState().role, action);
  },
};

/** The gate for one action, kept up to date with the role and the plan's status. */
export function useEditGate(action: EditAction): Gate {
  const role = useSessionStore((s) => s.role);
  const status = usePlanStore((s) => s.header.status);
  return canEdit({ status }, role, action);
}

/** Why the workspace's plan is read only for this role, or null when it can be changed. */
export function useReadOnlyReason(): string | null {
  const g = useEditGate('command');
  return g.ok ? null : g.reason;
}

/** What this role may do with the plan in the workspace (design 10). */
export function usePlanActions(): PlanActions {
  const role = useSessionStore((s) => s.role);
  const status = usePlanStore((s) => s.header.status);
  const errors = usePlanStore((s) => s.violations.filter((v) => v.severity === 'error').length);
  return planActions({ status, errors }, role);
}

/** What this role may do with a plan in the plans list (design 15). */
export function usePreviewActions(plan: {
  status: PlanStatus;
  errors: number;
  openable: boolean;
}): PlanActions {
  const role = useSessionStore((s) => s.role);
  return planActions(plan, role);
}

const onReadOnly = new Set<() => void>();

// Switching role takes effect at once and keeps the unsaved commands (decision 1, design 09).
// A container in hand is put back when the new role cannot change the plan.
let lastRole = useSessionStore.getState().role;
useSessionStore.subscribe((s) => {
  if (s.role === lastRole) return;
  lastRole = s.role;
  if (!editGate.check('command').ok) onReadOnly.forEach((f) => f());
});

/** Runs `f` when a role switch makes the plan read only. Returns the unsubscribe. */
export function whenReadOnly(f: () => void): () => void {
  onReadOnly.add(f);
  return () => onReadOnly.delete(f);
}

/** What the read-only strip says (design 11), or null when the plan can be changed. */
export interface ReadOnlyInfo {
  reason: string;
  /** Who approved it and when, on an approved plan. */
  approved: { by: string; at: string | null } | null;
  /** "Terminal planner · Read only" for a role that only reads. */
  roleNote: string | null;
  /** The way out: Revise an approved plan, or switch to a role that edits. */
  way: 'revise' | 'switchRole' | null;
}

export function useReadOnlyStrip(): ReadOnlyInfo | null {
  const role = useSessionStore((s) => s.role);
  const header = usePlanStore((s) => s.header);
  const gate = canEdit(header, role, 'command');
  if (gate.ok) return null;
  const info = roleInfo(role);
  const approved =
    header.status === 'approved' && header.statusBy
      ? { by: header.statusBy, at: header.statusAt }
      : null;
  return {
    reason: gate.reason,
    approved,
    roleNote: approved || info.canEdit ? null : `${info.label} · Read only`,
    way: canEdit(header, role, 'revise').ok ? 'revise' : info.canEdit ? null : 'switchRole',
  };
}
