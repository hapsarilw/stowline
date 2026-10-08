import type { EditAction } from '@/domain';
import { editGate } from './edit-gate';
import { useViewStore } from './view-store';

/**
 * Asks the edit gate for an action. On "no" the reason is said in the live region, after
 * `prefix` when given (the bay grid says the slot first, design 11).
 */
export function allowed(action: EditAction, prefix?: string): boolean {
  const g = editGate.check(action);
  if (!g.ok) useViewStore.getState().announce(prefix ? `${prefix}. ${g.reason}` : g.reason);
  return g.ok;
}
