import { create } from 'zustand';
import { createApi } from '@/api/client';
import { isApiError } from '@/api/errors';
import { currentSession } from './session-store';

// The one client, and the one place a failed request becomes a message with Retry (NFR-18).

export const api = createApi(currentSession);

interface RequestErrorStore {
  error: { message: string; retry: () => void } | null;
  /** The attempt that is running after Retry, for "Retrying… Attempt 2" (design 14). */
  retrying: number | null;
  attempts: number;
  show: (message: string, retry: () => void) => void;
  dismiss: () => void;
  /** Runs the request again, showing that it is running. */
  retry: () => void;
}

export const useRequestError = create<RequestErrorStore>()((set, get) => ({
  error: null,
  retrying: null,
  attempts: 1,
  show: (message, retry) => set({ error: { message, retry }, retrying: null }),
  dismiss: () => set({ error: null, retrying: null, attempts: 1 }),
  retry() {
    const e = get().error;
    if (!e) return;
    const attempt = get().attempts + 1;
    set({ retrying: attempt, attempts: attempt });
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

/**
 * Runs a request. When it fails the message appears with Retry, which runs `retry`. Returns the
 * result, or the error for the caller that has its own flow for some codes (409, 422).
 */
export async function request<T>(
  fn: () => Promise<T>,
  retry: () => void,
  own: (e: unknown) => boolean = () => false,
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    const data = await fn();
    useRequestError.getState().dismiss();
    return { ok: true, data };
  } catch (error) {
    if (!own(error)) useRequestError.getState().show(describeError(error), retry);
    return { ok: false, error };
  }
}
