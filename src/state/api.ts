import { create } from 'zustand';
import { createApi } from '@/api/client';
import { isApiError } from '@/api/errors';
import { currentSession } from './session-store';

// The one client, and the one place a failed request becomes a message with Retry (NFR-18).

export const api = createApi(currentSession);

/**
 * Up to 3 attempts for a failure that may pass on its own (design 14: "Attempt 2 of 3"): no
 * connection (status 0), a server error (5xx) or too many requests (429). A refusal (4xx) is the
 * answer and is not tried again. A repeated save is safe: it carries its base version, and a
 * repeated import is refused row by row ("ID is already on this plan.").
 */
export const RETRY = { attempts: 3, delaysMs: [300, 900] };

const passing = (e: unknown): boolean =>
  isApiError(e) && (e.status === 0 || e.status >= 500 || e.status === 429);

interface RequestErrorStore {
  error: { message: string; retry: () => void } | null;
  /** The attempt that is running again, 2 or 3 of RETRY.attempts, for "Retrying… Attempt 2". */
  retrying: number | null;
  show: (message: string, retry: () => void) => void;
  setRetrying: (attempt: number | null) => void;
  dismiss: () => void;
  /** Runs the request again, as a new round of attempts. */
  retry: () => void;
}

export const useRequestError = create<RequestErrorStore>()((set, get) => ({
  error: null,
  retrying: null,
  show: (message, retry) => set({ error: { message, retry }, retrying: null }),
  setRetrying: (retrying) => set({ retrying }),
  dismiss: () => set({ error: null, retrying: null }),
  retry() {
    const e = get().error;
    if (!e) return;
    set({ retrying: 1 });
    e.retry();
  },
}));

/** What a person reads when a request failed. */
export function describeError(e: unknown): string {
  if (isApiError(e))
    return e.status === 0
      ? 'The server could not be reached. Check the connection and try again.'
      : e.message;
  return 'Something went wrong. Try again.';
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a request, up to RETRY.attempts times while it fails in a way that may pass. The message
 * shows "Retrying…" with the attempt while it runs again; after the last attempt it shows the
 * message with Retry, which runs `retry`. Returns the result, or the error for the caller that
 * has its own flow for some codes (409, 422).
 */
export async function request<T>(
  fn: () => Promise<T>,
  retry: () => void,
  own: (e: unknown) => boolean = () => false,
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  const store = useRequestError.getState;
  for (let attempt = 1; ; attempt++) {
    try {
      const data = await fn();
      store().dismiss();
      return { ok: true, data };
    } catch (error) {
      if (!own(error) && passing(error) && attempt < RETRY.attempts) {
        if (!store().error) store().show(describeError(error), retry);
        store().setRetrying(attempt + 1);
        await wait(RETRY.delaysMs[attempt - 1] ?? 0);
        continue;
      }
      if (!own(error)) store().show(describeError(error), retry);
      else store().setRetrying(null);
      return { ok: false, error };
    }
  }
}
