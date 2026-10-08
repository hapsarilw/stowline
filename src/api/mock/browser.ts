import { setupWorker } from 'msw/browser';
import { useMockControl } from './control';
import { MockDb } from './db';
import { createHandlers } from './handlers';
import { indexedDbStorage } from './storage';

/** Starts the mock API in the browser. The plans are kept in IndexedDB. */
export async function startMockApi(): Promise<void> {
  const db = new MockDb(indexedDbStorage());
  const worker = setupWorker(...createHandlers(db));
  await worker.start({
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  // The developer switches, for a demo or a test.
  (window as unknown as { __stowMock: unknown }).__stowMock = {
    control: useMockControl,
    ready: db.ready,
    /** Wipes the saved plans, so the next load starts from the seed. */
    reset: async () => {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('stowline-mock');
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
      location.reload();
    },
  };
}
