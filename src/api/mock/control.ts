import { create } from 'zustand';

// Developer switches for the demo (SRS "Mock behavior"). They live in the account menu and on
// window.__stowMock, so a person or a test can force a conflict or a failed request.

export interface MockControl {
  /** The next save returns 409, as if a colleague had saved first. */
  force409: boolean;
  /** The next n requests fail with this status. */
  /** The next n requests fail with this status; with `path`, only requests whose path ends with it. */
  failNext: { status: number; times: number; path?: string } | null;
  /** Extra wait on every request, in ms, to look at a loading state or test a slow server. */
  extraDelayMs: number;
  setExtraDelay: (ms: number) => void;
  setForce409: (on: boolean) => void;
  setFailNext: (status: number, times?: number, path?: string) => void;
}

export const useMockControl = create<MockControl>()((set) => ({
  force409: false,
  failNext: null,
  extraDelayMs: 0,
  setExtraDelay: (extraDelayMs) => set({ extraDelayMs }),
  setForce409: (force409) => set({ force409 }),
  setFailNext: (status, times = 1, path) =>
    set({ failNext: times > 0 ? { status, times, ...(path ? { path } : {}) } : null }),
}));

/** Takes a forced failure for this request, if one is set. */
export function takeFailure(url = ''): number | null {
  const { failNext } = useMockControl.getState();
  if (!failNext) return null;
  if (failNext.path && !new URL(url, 'http://x').pathname.endsWith(failNext.path)) return null;
  useMockControl.setState({
    failNext: failNext.times > 1 ? { ...failNext, times: failNext.times - 1 } : null,
  });
  return failNext.status;
}

/** The 409 switch is one shot: true once, then it switches itself off. */
export function takeForce409(): boolean {
  const { force409 } = useMockControl.getState();
  if (force409) useMockControl.setState({ force409: false });
  return force409;
}
