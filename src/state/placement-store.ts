import { create } from 'zustand';
import {
  bay40Of,
  halfOfKey,
  parseKey,
  type Command,
  type CommandResult,
  type SlotKey,
} from '@/domain';
import { resultMessage } from './messages';
import {
  heldContainer,
  IDLE,
  step,
  targetsInBay,
  type PlacementEvent,
  type PlacementState,
} from './placement';
import { usePlanStore } from './plan-store';
import { useViewStore } from './view-store';

// Runs the placement controller: keeps its state, and carries out what step() asks for through
// the plan store and the view store. Every pointer, click and keyboard path ends in dispatch().

export interface PlacementStore {
  placement: PlacementState;
  /** performance.now() of the last pick-up, until its target marks are on screen (NFR-02). */
  pickedAt: number | null;
  /** The slot that shakes once after a refused drop (FR-35). seq restarts the animation. */
  shake: { key: SlotKey; seq: number } | null;
  /** The slot a container just settled into. */
  settle: { key: SlotKey; seq: number } | null;
}

export const usePlacementStore = create<PlacementStore>()(() => ({
  placement: IDLE,
  pickedAt: null,
  shake: null,
  settle: null,
}));

export function resetPlacementStore(): void {
  usePlacementStore.setState({ placement: IDLE, pickedAt: null, shake: null, settle: null });
}

let seq = 0;

/**
 * Applies a command through the plan store and shows the result message with Undo (FR-57).
 * Returns the domain result.
 */
export function runCommand(command: Command): CommandResult {
  const plan = usePlanStore.getState();
  const before = { state: plan.state, violations: plan.violations };
  const r = plan.apply(command);
  const view = useViewStore.getState();
  if (!r.ok) {
    view.showToast({ kind: 'err', title: 'Not done', message: r.reason });
    return r;
  }
  const after = usePlanStore.getState();
  const m = resultMessage(
    command,
    before,
    { state: after.state, violations: after.violations },
    plan.ctx,
  );
  view.showToast({ kind: m.kind, title: m.title, message: m.message, undo: true });
  return r;
}

export function undoLast(): void {
  const view = useViewStore.getState();
  const text = usePlanStore.getState().history.at(-1)?.text;
  dispatch({ type: 'cancel' });
  if (!usePlanStore.getState().undo()) return;
  view.showToast({ kind: 'info', title: 'Undone', message: text ?? '' });
  view.announce(`Undone: ${text ?? ''}.`);
}

export function redoLast(): void {
  const view = useViewStore.getState();
  dispatch({ type: 'cancel' });
  if (!usePlanStore.getState().redo()) return;
  const text = usePlanStore.getState().history.at(-1)?.text ?? '';
  view.showToast({ kind: 'info', title: 'Redone', message: text });
  view.announce(`Redone: ${text}.`);
}

/** The first valid target in the bay on view, to put the keyboard focus on after a pick-up. */
function firstValidTarget(containerId: string, from: SlotKey | null): SlotKey | null {
  const { state, ctx } = usePlanStore.getState();
  const c = ctx.containers.get(containerId);
  if (!c) return null;
  const t = targetsInBay({ state, ctx }, c, from, useViewStore.getState().bay);
  return (
    (
      t.find((x) => x.check.valid && x.check.warnings.length === 0) ??
      t.find((x) => x.check.valid) ??
      t[0]
    )?.key ?? null
  );
}

export function dispatch(event: PlacementEvent): void {
  const plan = usePlanStore.getState();
  const view = useViewStore.getState();
  const prev = usePlacementStore.getState().placement;
  const out = step(prev, event, { state: plan.state, ctx: plan.ctx, bay: view.bay });
  const patch: Partial<PlacementStore> = { placement: out.next };

  if (out.command) {
    const r = runCommand(out.command);
    if (!r.ok) {
      usePlacementStore.setState({ placement: prev });
      return;
    }
    const to = out.command.kind === 'place' || out.command.kind === 'move' ? out.command.to : null;
    if (to) {
      view.select(to, { bay: bay40Of(parseKey(to).bay) });
      patch.settle = { key: to, seq: ++seq };
      if (out.next.kind === 'idle' && halfOfKey(to) !== useViewStore.getState().half) {
        useViewStore.getState().setHalf(halfOfKey(to));
      }
    }
    if (out.command.kind === 'place') {
      const id = out.command.containerId;
      if (useViewStore.getState().checked[id]) useViewStore.getState().toggleChecked(id);
    }
  }

  // A pick-up: a different container is now in hand (a new pick, or the next queued row).
  // Read the stores again: a command above may have changed the plan and the view.
  const next = out.next;
  if (next.kind === 'holding' && heldContainer(prev) !== next.source.containerId) {
    patch.pickedAt = performance.now();
    const now = usePlanStore.getState();
    const v = useViewStore.getState();
    const c = now.ctx.containers.get(next.source.containerId);
    // 20ft containers go into the fore or aft halves, 40ft into whole slots (D1).
    if (c) {
      const want = c.lengthFt === 20 ? (v.half === 'aft' ? 'aft' : 'fore') : 'both';
      if (v.half !== want) v.setHalf(want);
    }
    if (next.via === 'keyboard') {
      // FR-17: the keyboard goes on in the bay grid, on the first valid target.
      if (v.centerTab === '3d') v.setCenterTab('split');
      const from = next.source.kind === 'slot' ? next.source.from : null;
      const focus = firstValidTarget(next.source.containerId, from);
      if (focus) {
        v.setFocus(focus);
        // Held over the focused target, so the strip previews it (FR-51). The pick-up sentence stays.
        const world = { state: now.state, ctx: now.ctx, bay: v.bay };
        patch.placement = step(next, { type: 'hover', key: focus }, world).next;
      }
      v.requestGridFocus();
    }
  }

  if (out.refusal) {
    const { title, reason, returned } = out.refusal;
    // Refused drops are announced at once: the toast is an alert (NFR-14).
    view.showToast({
      kind: 'err',
      title,
      message: returned ? `${reason}. ${returned}` : `${reason}.`,
    });
    if (out.refusal.key) patch.shake = { key: out.refusal.key, seq: ++seq };
  }
  if (out.announce) useViewStore.getState().announce(out.announce);
  if (out.next.kind === 'idle') patch.pickedAt = null;
  usePlacementStore.setState(patch);
}

/** The keyboard path from the load list (FR-17), with the other ticked rows queued (FR-39). */
export function pickFromList(containerId: string, via: 'keyboard' | 'pointer'): void {
  const { loadList, state } = usePlanStore.getState();
  const checked = useViewStore.getState().checked;
  // Only a selected row brings the other selected rows with it, the next ones in list order first.
  const rows = checked[containerId]
    ? loadList.filter((c) => checked[c.id] && !state.slotOf.has(c.id)).map((c) => c.id)
    : [];
  const at = rows.indexOf(containerId);
  const queue = at < 0 ? [] : [...rows.slice(at + 1), ...rows.slice(0, at)];
  dispatch({ type: 'pickFromList', containerId, via, queue });
}
