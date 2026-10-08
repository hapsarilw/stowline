import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/errors';
import { RETRY, request, useRequestError } from './api';

// Requests (design 14, NFR-18): up to 3 attempts for a failure that may pass on its own (no
// connection, a server error, too many requests), with the attempt number for the screen. A
// refusal (4xx) is not tried again. After the last attempt the message with Retry stays.

const fail = (status: number) =>
  new ApiError(status, { code: 'x', message: `Failed ${status}` }, `GET /plans · ${status}`);

const delays = RETRY.delaysMs;
beforeEach(() => {
  RETRY.delaysMs = [0, 0];
  useRequestError.getState().dismiss();
});
afterEach(() => {
  RETRY.delaysMs = delays;
});

/** A request that fails `n` times with `status`, then answers. Records the attempt it saw. */
function flaky(n: number, status: number) {
  let calls = 0;
  const seen: (number | null)[] = [];
  const fn = () => {
    seen.push(useRequestError.getState().retrying);
    calls++;
    return calls <= n ? Promise.reject(fail(status)) : Promise.resolve('ok');
  };
  return { fn, calls: () => calls, seen };
}

describe('request: up to 3 attempts', () => {
  it('tries again after a server error, shows the attempt, and clears it on success', async () => {
    const f = flaky(2, 503);
    const r = await request(f.fn, () => undefined);
    expect(r).toEqual({ ok: true, data: 'ok' });
    expect(f.calls()).toBe(3);
    // Attempt 1 runs quietly; attempts 2 and 3 show "Retrying… Attempt N of 3".
    expect(f.seen).toEqual([null, 2, 3]);
    expect(RETRY.attempts).toBe(3);
    expect(useRequestError.getState()).toMatchObject({ error: null, retrying: null });
  });

  it('after the third failure the message stays, with Retry', async () => {
    const f = flaky(5, 0);
    const r = await request(f.fn, () => undefined);
    expect(r.ok).toBe(false);
    expect(f.calls()).toBe(3);
    const s = useRequestError.getState();
    expect(s.error?.message).toBe(
      'The server could not be reached. Check the connection and try again.',
    );
    expect(s.retrying).toBeNull();
  });

  it('does not try a refusal again (4xx), and leaves a 409 or 422 to its caller', async () => {
    for (const status of [403, 404, 409, 422]) {
      useRequestError.getState().dismiss();
      const f = flaky(1, status);
      const r = await request(
        f.fn,
        () => undefined,
        (e) => (e as ApiError).status === 409,
      );
      expect(r.ok, String(status)).toBe(false);
      expect(f.calls(), String(status)).toBe(1);
      expect(useRequestError.getState().error === null, String(status)).toBe(status === 409);
    }
  });

  it('tries again after 429 too', async () => {
    const f = flaky(1, 429);
    expect((await request(f.fn, () => undefined)).ok).toBe(true);
    expect(f.calls()).toBe(2);
  });
});
