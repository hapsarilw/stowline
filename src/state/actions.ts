import { toPlacements } from '@/domain';
import { plural } from '@/domain';
import type { ValidationClient } from '@/worker/client';
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
