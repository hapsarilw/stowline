import {
  fmt1,
  pad,
  plural,
  PODS,
  type FixSuggestion,
  type SlotKey,
  type StowContext,
  type StowState,
  type Violation,
} from '@/domain';
import { RULE_TITLES } from '@/state/messages';
import type { SeverityFilter } from '@/state/view-store';

// What the violations panel shows (FR-42, FR-44), worked out from the plan. Pure, so the rows
// can be tested without a browser. The fixes come from the domain (suggestFix).

export interface InvolvedRow {
  slot: SlotKey;
  id: string;
  weight: string;
  pod: string;
  podCode: string;
}

export interface ViolationRow {
  id: string;
  severity: 'error' | 'warning';
  /** "Error · Stack weight" */
  heading: string;
  message: string;
  slot: SlotKey;
  /** For the row's accessible name: "error: Stack 18-04 deck: 96.4 t of 90.0 t limit". */
  label: string;
  selected: boolean;
  /** New since the last change: slides in (FR-45). */
  isNew: boolean;
  involved: InvolvedRow[];
  /** The fix, or why there is none (FR-44). */
  fixText: string;
  /** The button that runs it: Apply fix, or the alternative (Unplace) when there is no fix. */
  action: { label: string; name: string } | null;
}

export interface ViolationGroup {
  severity: 'error' | 'warning';
  label: 'Errors' | 'Warnings';
  rows: ViolationRow[];
}

export interface ViolationsModel {
  filters: { id: SeverityFilter; label: string; count: number }[];
  summary: string;
  groups: ViolationGroup[];
  empty: boolean;
}

export interface ViolationsInput {
  violations: readonly Violation[];
  state: StowState;
  ctx: StowContext;
  severity: SeverityFilter;
  focused: string | null;
  newIds: ReadonlySet<string>;
  checkedAt: Date;
  fixOf: (v: Violation) => FixSuggestion;
}

/** 14:32:08, in local time, as the design prints the time of the last check. */
export const clock = (d: Date): string =>
  [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => pad(n)).join(':');

function involved(v: Violation, s: StowState, ctx: StowContext): InvolvedRow[] {
  return v.slotKeys.flatMap((slot) => {
    const p = s.placements.get(slot);
    const c = p && ctx.containers.get(p.containerId);
    if (!c) return [];
    const pod = PODS[c.pod as keyof typeof PODS];
    return [{ slot, id: c.id, weight: fmt1(c.weightT), pod: pod?.short ?? c.pod, podCode: c.pod }];
  });
}

function row(v: Violation, input: ViolationsInput): ViolationRow {
  const fix = input.fixOf(v);
  const sev = v.severity === 'error' ? 'Error' : 'Warning';
  return {
    id: v.id,
    severity: v.severity,
    heading: `${sev} · ${RULE_TITLES[v.rule]}`,
    message: v.message,
    slot: v.slot,
    label: `${v.severity}: ${v.message}`,
    selected: v.id === input.focused,
    isNew: input.newIds.has(v.id),
    involved: involved(v, input.state, input.ctx),
    fixText: fix.kind === 'fix' ? fix.text : fix.reason,
    action:
      fix.kind === 'fix'
        ? { label: 'Apply fix', name: `Apply fix: ${fix.text}` }
        : fix.alternative
          ? { label: 'Unplace', name: fix.alternative.text }
          : null,
  };
}

export function buildViolations(input: ViolationsInput): ViolationsModel {
  const errors = input.violations.filter((v) => v.severity === 'error');
  const warnings = input.violations.filter((v) => v.severity === 'warning');
  const n = errors.length;
  const blocks =
    n === 0
      ? 'No errors block approval'
      : `${plural(n, 'error')} ${n === 1 ? 'blocks' : 'block'} approval`;
  const groups: ViolationGroup[] = [];
  if (input.severity !== 'warning' && errors.length)
    groups.push({ severity: 'error', label: 'Errors', rows: errors.map((v) => row(v, input)) });
  if (input.severity !== 'error' && warnings.length)
    groups.push({
      severity: 'warning',
      label: 'Warnings',
      rows: warnings.map((v) => row(v, input)),
    });
  return {
    filters: [
      { id: 'all', label: 'All', count: input.violations.length },
      { id: 'error', label: 'Errors', count: errors.length },
      { id: 'warning', label: 'Warnings', count: warnings.length },
    ],
    summary: `${blocks} · checked ${clock(input.checkedAt)} · re-checks on every move`,
    groups,
    empty: input.violations.length === 0,
  };
}

/** The focus banner over the 3D view (design 04). */
export function focusBanner(v: Violation): {
  count: number;
  title: string;
  severity: 'error' | 'warning';
} {
  return {
    count: v.slotKeys.length,
    title: `${RULE_TITLES[v.rule]} · ${v.slot}`,
    severity: v.severity,
  };
}
