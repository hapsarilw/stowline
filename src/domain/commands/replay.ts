import type { StowContext } from '../plan/context';
import type { StowState } from '../plan/state';
import type { Command, SlotKey } from '../types';
import { applyCommand } from './commands';

// The conflict review (decision 6, FR-60, design 12): the server saved a newer version first.
// The kept changes are checked for overlap with the server's changes by slot, then replayed on
// the server version through the normal command path with the rule check.

/** The slots a command touches, in order, each once. */
export function slotsOf(cmd: Command): SlotKey[] {
  const out: SlotKey[] = [];
  const walk = (c: Command) => {
    switch (c.kind) {
      case 'place':
        out.push(c.to);
        break;
      case 'move':
        out.push(c.from, c.to);
        break;
      case 'unplace':
        out.push(c.from);
        break;
      case 'swap':
        out.push(c.a, c.b);
        break;
      case 'lock':
      case 'unlock':
        out.push(c.at);
        break;
      case 'batch':
        c.commands.forEach(walk);
        break;
    }
  };
  walk(cmd);
  return [...new Set(out)];
}

/** Each kept change that touches a slot one of the server's changes touched, with those slots. */
export function overlapsBySlot(
  kept: readonly Command[],
  server: readonly Command[],
): { index: number; slots: SlotKey[] }[] {
  const theirs = new Set(server.flatMap(slotsOf));
  const out: { index: number; slots: SlotKey[] }[] = [];
  kept.forEach((c, index) => {
    const slots = slotsOf(c).filter((k) => theirs.has(k));
    if (slots.length) out.push({ index, slots });
  });
  return out;
}

export type ReplayResult =
  { ok: true; state: StowState } | { ok: false; index: number; command: Command; reason: string };

/**
 * Puts the kept changes on the server version, in order, each with the rule check. The first
 * one that is refused stops the replay: the result names it and its reason, and nothing is
 * applied (the state passed in is never changed).
 */
export function replayOnto(
  state: StowState,
  ctx: StowContext,
  kept: readonly Command[],
): ReplayResult {
  let s = state;
  for (const [index, command] of kept.entries()) {
    const r = applyCommand(s, ctx, command);
    if (!r.ok) return { ok: false, index, command, reason: r.reason };
    s = r.state;
  }
  return { ok: true, state: s };
}
