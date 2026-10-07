import type { StowContext } from '../plan/context';
import { stackIdOf, stackIdsInUse, type StowState } from '../plan/state';
import type { RuleId, Violation } from '../types';
import { dgViolations } from './dg';
import { checkStack } from './stack-rules';

export const RULE_ORDER: Readonly<Record<RuleId, number>> = {
  stack: 1,
  reefer: 2,
  dg: 3,
  overstow: 4,
  twenty: 5,
  heavy: 6,
};

/** Errors first, then rule order R1 to R6, then slot. */
export function sortViolations(list: readonly Violation[]): Violation[] {
  return [...list].sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
      RULE_ORDER[a.rule] - RULE_ORDER[b.rule] ||
      a.slot.localeCompare(b.slot) ||
      a.id.localeCompare(b.id),
  );
}

export function summarize(list: readonly Violation[]): { errors: number; warnings: number } {
  const errors = list.filter((v) => v.severity === 'error').length;
  return { errors, warnings: list.length - errors };
}

/**
 * Violations that belong to the given stacks: the stack rules of those stacks, and the
 * DG pairs where at least one container is in them. Not sorted.
 */
export function validateStacks(
  s: StowState,
  ctx: StowContext,
  stackIds: Iterable<string>,
): Violation[] {
  const scope = new Set(stackIds);
  const out: Violation[] = [];
  for (const id of scope) out.push(...checkStack(s, ctx, id));
  if (scope.size > 0) out.push(...dgViolations(s, ctx, scope));
  return out;
}

/** Full validation: every rule on the whole plan. */
export function validateAll(s: StowState, ctx: StowContext): Violation[] {
  const out: Violation[] = [];
  for (const id of stackIdsInUse(s)) out.push(...checkStack(s, ctx, id));
  out.push(...dgViolations(s, ctx));
  return sortViolations(out);
}

/** Whether a violation belongs to one of the stacks, so it must be checked again. */
function ownedBy(v: Violation, stacks: ReadonlySet<string>): boolean {
  if (v.rule === 'dg') return v.slotKeys.some((k) => stacks.has(stackIdOf(k)));
  return stacks.has(stackIdOf(v.slot));
}

/**
 * Incremental validation (FR-40). Keeps the violations of the stacks a command did not touch
 * and checks the touched stacks again. Gives the same list as validateAll.
 */
export function revalidate(
  previous: readonly Violation[],
  s: StowState,
  ctx: StowContext,
  touched: Iterable<string>,
): Violation[] {
  const stacks = new Set(touched);
  if (stacks.size === 0) return [...previous];
  const kept = previous.filter((v) => !ownedBy(v, stacks));
  return sortViolations([...kept, ...validateStacks(s, ctx, stacks)]);
}

export interface ViolationIndex {
  /** The worst violation at each slot, errors before warnings. */
  bySlot: Map<string, Violation>;
  /** Violation count per 40ft bay. */
  byBay: Map<number, number>;
}

export function indexViolations(list: readonly Violation[]): ViolationIndex {
  const bySlot = new Map<string, Violation>();
  const byBay = new Map<number, number>();
  for (const v of list) {
    byBay.set(v.bay, (byBay.get(v.bay) ?? 0) + 1);
    for (const key of v.slotKeys) {
      const old = bySlot.get(key);
      if (!old || (v.severity === 'error' && old.severity !== 'error')) bySlot.set(key, v);
    }
  }
  return { bySlot, byBay };
}
