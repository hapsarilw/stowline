import {
  fmtTenths,
  pad,
  parseStackId,
  stackIdOf,
  stackLimitTenths,
  stackWeightTenths,
  type Command,
  type RuleId,
  type StowContext,
  type StowState,
  type Violation,
} from '@/domain';

// Words for commands: the activity log (FR-58) and the result message after a command, which
// always offers Undo (FR-57). The titles and formats are the design's (workspace-vm.js apply).

export const RULE_TITLES: Readonly<Record<RuleId, string>> = {
  stack: 'Stack weight',
  reefer: 'Reefer power',
  dg: 'DG segregation',
  overstow: 'Overstow',
  twenty: '20ft on 40ft',
  heavy: 'Heavy over light',
};

const idAt = (s: StowState, key: string): string => s.placements.get(key)?.containerId ?? key;

/** One line for the activity log, from the state the command was applied to. */
export function activityText(cmd: Command, before: StowState): string {
  switch (cmd.kind) {
    case 'place':
      return `Placed ${cmd.containerId} at ${cmd.to}`;
    case 'move':
      return `Moved ${idAt(before, cmd.from)} from ${cmd.from} to ${cmd.to}`;
    case 'unplace':
      return `Unplaced ${idAt(before, cmd.from)} from ${cmd.from}`;
    case 'swap':
      return `Swapped ${idAt(before, cmd.a)} at ${cmd.a} with ${idAt(before, cmd.b)} at ${cmd.b}`;
    case 'lock':
      return `Locked ${idAt(before, cmd.at)} at ${cmd.at}`;
    case 'unlock':
      return `Unlocked ${idAt(before, cmd.at)} at ${cmd.at}`;
    case 'batch':
      return cmd.commands.map((c) => activityText(c, before)).join('; ');
  }
}

export interface ResultMessage {
  kind: 'ok' | 'warn';
  title: string;
  message: string;
}

/** The "back to" line for a resolved stack weight, as in the components sheet. */
function resolvedText(v: Violation, after: StowState, ctx: StowContext): string {
  if (v.rule !== 'stack') return v.message;
  const id = stackIdOf(v.slot);
  const ref = parseStackId(id);
  const sum = stackWeightTenths(after, ctx, id);
  const limit = stackLimitTenths(ctx, id);
  return `Stack ${pad(ref.bay40)}-${pad(ref.row)} ${ref.deck ? 'deck' : 'hold'} back to ${fmtTenths(sum)} t of ${fmtTenths(limit)} t`;
}

/**
 * The message after a command: a new violation first, then a resolved one, else what was done.
 * A move of a container loaded at an earlier port says it counts as a restow (FR-49).
 */
export function resultMessage(
  cmd: Command,
  before: { state: StowState; violations: readonly Violation[] },
  after: { state: StowState; violations: readonly Violation[] },
  ctx: StowContext,
): ResultMessage {
  const beforeIds = new Set(before.violations.map((v) => v.id));
  const afterIds = new Set(after.violations.map((v) => v.id));
  const added = after.violations.find((v) => !beforeIds.has(v.id));
  const resolved = before.violations.find((v) => !afterIds.has(v.id));
  const restow = after.state.shiftCount > before.state.shiftCount ? ' · counts as a restow' : '';

  if (added)
    return {
      kind: 'warn',
      title: `New violation · ${RULE_TITLES[added.rule]}`,
      message: added.message,
    };
  if (resolved) {
    return {
      kind: 'ok',
      title: `Resolved · ${RULE_TITLES[resolved.rule]}`,
      message: resolvedText(resolved, after.state, ctx) + restow,
    };
  }
  const b = before.state;
  switch (cmd.kind) {
    case 'place':
      return { kind: 'ok', title: `Placed ${cmd.containerId}`, message: `Slot ${cmd.to}` };
    case 'move':
      return {
        kind: 'ok',
        title: `Moved ${idAt(b, cmd.from)}`,
        message: `${cmd.from} → ${cmd.to}${restow}`,
      };
    case 'unplace':
      return {
        kind: 'ok',
        title: `Unplaced ${idAt(b, cmd.from)}`,
        message: 'Returned to load list',
      };
    case 'swap':
      return { kind: 'ok', title: 'Swapped', message: `${cmd.a} ↔ ${cmd.b}${restow}` };
    case 'lock':
      return { kind: 'ok', title: `Locked ${cmd.at}`, message: idAt(b, cmd.at) };
    case 'unlock':
      return { kind: 'ok', title: `Unlocked ${cmd.at}`, message: idAt(b, cmd.at) };
    case 'batch':
      return { kind: 'ok', title: 'Plan updated', message: activityText(cmd, b) + restow };
  }
}
