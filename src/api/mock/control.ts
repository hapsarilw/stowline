import { create } from 'zustand';

// Developer switches for the demo (SRS "Mock behavior"). They live in the account menu and on
// window.__stowMock, so a person or a test can force a conflict or a failed request.

export interface MockControl {
  /** The next save returns 409, as if a colleague had saved first. */
  force409: boolean;
  /** The next n requests fail with this status. */
  failNext: { status: number; times: number } | null;
  setForce409: (on: boolean) => void;
  setFailNext: (status: number, times?: number) => void;
}

export const useMockControl = create<MockControl>()((set) => ({
  force409: false,
  failNext: null,
  setForce409: (force409) => set({ force409 }),
  setFailNext: (status, times = 1) => set({ failNext: times > 0 ? { status, times } : null }),
}));

/** Takes a forced failure for this request, if one is set. */
export function takeFailure(): number | null {
  const { failNext } = useMockControl.getState();
  if (!failNext) return null;
  useMockControl.setState({
    failNext: failNext.times > 1 ? { status: failNext.status, times: failNext.times - 1 } : null,
  });
  return failNext.status;
}

/** The 409 switch is one shot: true once, then it switches itself off. */
export function takeForce409(): boolean {
  const { force409 } = useMockControl.getState();
  if (force409) useMockControl.setState({ force409: false });
  return force409;
}
