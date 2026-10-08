import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { fetchPlan } from './workspace-load';

afterEach(() => vi.restoreAllMocks());

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('opening a plan (FR-04)', () => {
  it('asks for the vessel as soon as the plan arrives, without waiting for the load list (M7)', async () => {
    type Detail = Awaited<ReturnType<typeof api.getPlan>>;
    type Items = Awaited<ReturnType<typeof api.getLoadList>>;
    type Vessel = Awaited<ReturnType<typeof api.getVessel>>;
    const plan = deferred<Detail>();
    const items = deferred<Items>();
    const vessel = deferred<Vessel>();
    vi.spyOn(api, 'getPlan').mockReturnValue(plan.promise);
    vi.spyOn(api, 'getLoadList').mockReturnValue(items.promise);
    const getVessel = vi.spyOn(api, 'getVessel').mockReturnValue(vessel.promise);

    const loading = fetchPlan('042W-SGSIN');
    plan.resolve({ vesselId: 'nusantara-pioneer' } as Detail);
    await vi.waitFor(() => expect(getVessel).toHaveBeenCalledWith('nusantara-pioneer'));

    // The load list has not arrived; a failure still reaches the caller once.
    items.reject(new Error('load list failed'));
    vessel.reject(new Error('vessel failed'));
    await expect(loading).rejects.toThrow('load list failed');
  });
});
