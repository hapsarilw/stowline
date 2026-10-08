import { useMemo } from 'react';
import {
  applyCommand,
  computeStability,
  type StabilityBase,
  type StowContext,
  type StowState,
} from '@/domain';
import { pendingCommand, type PlacementState } from '@/state/placement';
import { usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';

// FR-51: while a container is held over a slot, the change in GM, trim and list it would make.
// It runs the same model as the committed result, on the plan with the candidate command
// (SRS "Drag preview").

export interface StabilityDelta {
  gm: number;
  trim: number;
  list: number;
}

export function previewDelta(
  placement: PlacementState,
  state: StowState,
  ctx: StowContext,
  base: StabilityBase,
  current: { gm: number; trim: number; list: number },
): StabilityDelta | null {
  const cmd = pendingCommand(placement);
  if (!cmd) return null;
  const r = applyCommand(state, ctx, cmd, { check: false });
  if (!r.ok) return null;
  const after = computeStability(r.state, ctx, base);
  return {
    gm: after.gm - current.gm,
    trim: after.trim - current.trim,
    list: after.list - current.list,
  };
}

/** Signed number with a real minus sign, as the design prints deltas: +0.04, −0.002. */
export const signed = (n: number, digits = 2): string =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;

/** The labels on the gauges, as in buildVM: GM to 3 decimals, trim in m, list in degrees. */
export function deltaLabels(d: StabilityDelta): { gm: string; trim: string; list: string } {
  return { gm: signed(d.gm, 3), trim: `${signed(d.trim)} m`, list: `${signed(d.list)}°` };
}

/** The preview for the placement in hand, or null. Recomputed only when the target changes. */
export function useStabilityPreview(): StabilityDelta | null {
  const placement = usePlacementStore((s) => s.placement);
  const state = usePlanStore((s) => s.state);
  const ctx = usePlanStore((s) => s.ctx);
  const base = usePlanStore((s) => s.base);
  const stability = usePlanStore((s) => s.stability);
  return useMemo(
    () => previewDelta(placement, state, ctx, base, stability),
    [placement, state, ctx, base, stability],
  );
}
