import {
  pad,
  plural,
  suggestFix,
  toPlacements,
  type FixSuggestion,
  type StowState,
  type Violation,
} from '@/domain';
import type { ValidationClient } from '@/worker/client';
import { runCommand } from './placement-store';
import { usePlanStore } from './plan-store';
import { useViewStore } from './view-store';

// Actions that use both stores.

let client: ValidationClient | undefined;

async function validationClient(): Promise<ValidationClient> {
  // Loaded when first used, so the worker code stays out of the first load.
  if (!client) {
    const { createValidationClient } = await import('@/worker/client');
    client = createValidationClient();
  }
  return client;
}

/** Validate (FR-41): all rules on the whole plan, in the worker. */
export async function runValidation(): Promise<void> {
  const view = useViewStore.getState();
  try {
    const { state, ctx } = usePlanStore.getState();
    const worker = await validationClient();
    const report = await worker.api.validate({
      vessel: ctx.vessel,
      containers: [...ctx.containers.values()],
      placements: toPlacements(state),
    });
    usePlanStore.getState().setViolations(report.violations);
    // The result is in the violations panel (design: Validate opens it).
    view.setRightTab('violations');
    if (!useViewStore.getState().rightOpen) view.toggleRight();
    const total = report.errors + report.warnings;
    view.showToast({
      kind: report.errors ? 'err' : 'ok',
      title: `Validation complete · ${plural(total, 'issue')}`,
      message: `${plural(report.errors, 'error')}, ${plural(report.warnings, 'warning')}. Plan can't be approved while errors remain.`,
    });
    view.announce(
      `Validation complete. ${plural(report.errors, 'error')}, ${plural(report.warnings, 'warning')}.`,
    );
  } catch {
    view.showToast({
      kind: 'err',
      title: 'Validation failed',
      message: 'The check could not run. Try Validate again.',
    });
  }
}

const fixCache = new WeakMap<StowState, Map<string, FixSuggestion>>();

/** The suggested fix for a violation on the plan as it is now (FR-44). Cached per plan state. */
export function fixFor(v: Violation): FixSuggestion {
  const { state, ctx } = usePlanStore.getState();
  let byId = fixCache.get(state);
  if (!byId) {
    byId = new Map();
    fixCache.set(state, byId);
  }
  let fix = byId.get(v.id);
  if (!fix) {
    fix = suggestFix(v, state, ctx);
    byId.set(v.id, fix);
  }
  return fix;
}

/** Show (FR-43): select the violation, dim the rest, move the camera to its bay. */
export function showViolation(id: string): void {
  const v = usePlanStore.getState().violations.find((x) => x.id === id);
  if (!v) return;
  const view = useViewStore.getState();
  view.closePlayback();
  view.focusViolation(v);
  view.announce(
    `Focused on ${plural(v.slotKeys.length, 'container')} in bay ${pad(v.bay)}: ${v.message}. Others dimmed.`,
  );
}

/**
 * Apply fix (FR-44): the fix, or the alternative when there is no fix, as one command. The
 * result message says what was resolved and offers Undo (FR-45).
 */
export function applyFix(id: string): void {
  const v = usePlanStore.getState().violations.find((x) => x.id === id);
  if (!v) return;
  const fix = fixFor(v);
  const command = fix.kind === 'fix' ? fix.command : fix.alternative?.command;
  if (!command) return;
  const r = runCommand(command);
  if (r.ok) useViewStore.getState().clearViolationFocus();
}
