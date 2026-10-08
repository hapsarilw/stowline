// Test hooks on window: in the dev server and in the end-to-end build (`vite build --mode e2e`,
// served to Playwright). Vite replaces both values at build time, so the production build
// drops every hook and this module's chunk.
import type { hook } from './worker-hook';

export const TEST_HOOKS = import.meta.env.DEV || import.meta.env.MODE === 'e2e';

declare global {
  interface Window {
    /** The worker client and the plan generators, for e2e/worker.spec.ts (NFR-04). */
    __stowWorkerTest?: typeof hook;
  }
}

/** Loads the hooks that are not part of a component. */
export async function installTestHooks(): Promise<void> {
  if (!TEST_HOOKS) return;
  window.__stowWorkerTest = (await import('./worker-hook')).hook;
}
