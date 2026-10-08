import { fmt1, PODS, type SlotKey } from '@/domain';
import { pickDropTarget, VIEWPORT_ATTR } from '@/features/viewport3d/bridge';
import { heldContainer } from '@/state/placement';
import { dispatch, pickFromList, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { FADE_MS, prefersReducedMotion } from '@/ui/motion';

// Pointer drag (FR-31, FR-33, FR-32). A press on a load list row or on the top container of a
// stack becomes a drag after a few pixels. From then on the pointer only sends events to the
// placement controller: hover when the slot under it changes, drop on release, cancel on Esc.
// The ghost follows the pointer by setting a transform. Nothing renders React on a pointer move.

export type DragSource = { kind: 'list'; containerId: string } | { kind: 'slot'; key: SlotKey };

/** Pixels the pointer moves before a press becomes a drag. Less is a click. */
const SLOP = 4;
/** A refused drop: the ghost goes back to where it came from (FR-35). */
const RETURN_MS = 220;

/** The slot under a point: a bay cell, or a target in the 3D view. */
export function slotAt(x: number, y: number): SlotKey | null {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>('[data-slot]');
  if (cell) return cell.dataset.slot ?? null;
  if (el?.closest(`[${VIEWPORT_ATTR}]`)) return pickDropTarget(x, y);
  return null;
}

/** The chip under the pointer, as drawn over the target in screen 02. */
function makeGhost(containerId: string): HTMLElement {
  const c = usePlanStore.getState().ctx.containers.get(containerId);
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.dataset.testid = 'drag-ghost';
  el.className =
    'pointer-events-none fixed top-0 left-0 z-50 flex h-7 w-[78px] items-center justify-center gap-[5px] rounded-[2px] border border-[#0b1220] font-mono text-[10.5px] font-bold text-[#0b1220] opacity-[.92] shadow-[0_6px_0_rgba(0,0,0,0.3)]';
  if (c) {
    el.style.backgroundColor = `var(--pod-${c.pod.toLowerCase()})`;
    el.style.backgroundImage =
      'repeating-linear-gradient(90deg, rgba(11,18,32,0.14) 0 2px, transparent 2px 6px)';
    const pod = PODS[c.pod as keyof typeof PODS]?.short ?? c.pod;
    for (const [text, weight] of [
      [c.id.slice(-6, -2), ''],
      [pod, ''],
      [fmt1(c.weightT), '500'],
    ] as const) {
      const span = document.createElement('span');
      span.textContent = text;
      if (weight) span.style.fontWeight = weight;
      el.append(span);
    }
  }
  document.body.append(el);
  return el;
}

/** The tip of the cursor sits just above and left of the chip, as in the design. */
const place = (el: HTMLElement, x: number, y: number) => {
  el.style.transform = `translate(${x + 5}px, ${y + 7}px)`;
};

let active = false;
let suppressClick = false;

/** True while a pointer drag is on. */
export const isDragging = (): boolean => active;

// A click event follows the pointer up that ends a drag. It is not a click on the cell.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}

/**
 * Starts watching a press. `origin` is where a refused drop goes back to.
 * Returns at once when the press is not the main button or something is already in hand.
 */
export function beginDrag(
  e: PointerEvent | React.PointerEvent,
  source: DragSource,
  origin: HTMLElement,
): void {
  if (e.button !== 0 || active || usePlacementStore.getState().placement.kind !== 'idle') return;
  const start = { x: e.clientX, y: e.clientY };
  let ghost: HTMLElement | null = null;
  let over: SlotKey | null = null;
  let last = start;
  let frame = 0;

  const cleanup = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    document.documentElement.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    active = false;
  };

  const startDrag = (): boolean => {
    if (source.kind === 'list') pickFromList(source.containerId, 'pointer');
    else dispatch({ type: 'pickFromSlot', key: source.key, via: 'pointer' });
    const held = heldContainer(usePlacementStore.getState().placement);
    if (!held) return false;
    active = true;
    ghost = makeGhost(held);
    document.documentElement.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return true;
  };

  // One hit test per frame, however fast the pointer moves.
  const track = () => {
    frame = 0;
    const key = slotAt(last.x, last.y);
    if (key !== over) {
      over = key;
      dispatch({ type: 'hover', key });
    }
  };

  const onMove = (ev: PointerEvent) => {
    last = { x: ev.clientX, y: ev.clientY };
    if (!ghost) {
      if (Math.abs(last.x - start.x) + Math.abs(last.y - start.y) < SLOP) return;
      if (!startDrag()) return cleanup();
    }
    place(ghost!, last.x, last.y);
    if (!frame) frame = requestAnimationFrame(track);
  };

  /** Removes the ghost, after sending it back to the origin when the drop was refused. */
  const finish = (refused: boolean) => {
    const el = ghost;
    ghost = null;
    if (!el) return;
    if (!refused || typeof el.animate !== 'function') {
      el.remove();
      return;
    }
    const to = origin.isConnected ? origin.getBoundingClientRect() : null;
    const a =
      prefersReducedMotion() || !to
        ? el.animate([{ opacity: 0.92 }, { opacity: 0 }], { duration: FADE_MS })
        : el.animate(
            [
              { transform: el.style.transform },
              {
                transform: `translate(${to.left + to.width / 2 - 39}px, ${to.top + to.height / 2 - 14}px)`,
                opacity: 0.6,
              },
            ],
            { duration: RETURN_MS, easing: 'ease-in-out' },
          );
    a.onfinish = () => el.remove();
    a.oncancel = () => el.remove();
  };

  const onUp = (ev: PointerEvent) => {
    const dragging = ghost !== null;
    cleanup();
    if (!dragging) return;
    suppressClick = true;
    // A click event may not follow (the pointer left the window): stop waiting for it.
    setTimeout(() => (suppressClick = false), 0);
    last = { x: ev.clientX, y: ev.clientY };
    const key = slotAt(last.x, last.y);
    if (key !== over) dispatch({ type: 'hover', key });
    const shake = usePlacementStore.getState().shake;
    dispatch({ type: 'drop' });
    finish(usePlacementStore.getState().shake !== shake || key === null);
  };

  const onCancel = () => {
    const dragging = ghost !== null;
    cleanup();
    if (!dragging) return;
    dispatch({ type: 'cancel' });
    finish(true);
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !ghost) return;
    ev.preventDefault();
    ev.stopPropagation();
    onCancel();
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
}
