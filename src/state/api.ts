import { create } from 'zustand';
import { createApi } from '@/api/client';
import { isApiError } from '@/api/errors';
import { currentSession } from './session-store';

// The one client, and the one place a failed request becomes a message with Retry (NFR-18).

export const api = createApi(currentSession);

interface RequestErrorStore {
  error: { message: string; retry: () => void } | null;
  show: (message: string, retry: () => void) => void;
  dismiss: () => void;
}

export const useRequestError = create<RequestErrorStore>()((set) => ({
  error: null,
  show: (message, retry) => set({ error: { message, retry } }),
  dismiss: () => set({ error: null }),
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
