// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { marksFor } from './placement';
import {
  dispatch,
  pickFromList,
  redoLast,
  resetPlacementStore,
  undoLast,
  usePlacementStore,
} from './placement-store';
import { resetPlanStore, usePlanStore } from './plan-store';
import { resetViewStore, useViewStore } from './view-store';

const plan = () => usePlanStore.getState();
const view = () => useViewStore.getState();
const placement = () => usePlacementStore.getState();

beforeEach(() => {
  resetPlanStore();
  resetViewStore();
  resetPlacementStore();
});

const world = () => ({ state: plan().state, ctx: plan().ctx, bay: view().bay });
const plain40 = () =>
  plan().loadList.find(
    (c) =>
      !plan().state.slotOf.has(c.id) &&
      !view().checked[c.id] &&
      c.lengthFt === 40 &&
      c.type !== 'RF' &&
      !c.imdgClass,
  )!;

describe('placement runner', () => {
  it('a keyboard pick-up from the list focuses the first valid target and asks the grid for focus (FR-17)', () => {
    view().setCenterTab('3d');
    const seq = view().gridFocusSeq;
    const c = plain40();
    pickFromList(c.id, 'keyboard');
    // Held over the focused target, so the strip can preview it.
    expect(placement().placement).toMatchObject({ kind: 'over', target: view().focus });
    expect(placement().pickedAt).not.toBeNull();
    expect(view().centerTab).toBe('split');
    expect(view().gridFocusSeq).toBe(seq + 1);
    expect(marksFor(placement().placement, world()).get(view().focus!)?.mark).toBe('valid');
    expect(view().announcement).toMatch(
      new RegExp(`^Picked up ${c.id} from the load list\\. \\d+ valid targets? in bay 18\\.`),
    );
  });

  it('places, selects the slot, logs it and offers Undo (FR-31, FR-57, FR-58)', () => {
    const c = plain40();
    pickFromList(c.id, 'keyboard');
    const to = view().focus!;
    dispatch({ type: 'drop' });
    expect(placement().placement.kind).toBe('idle');
    expect(placement().pickedAt).toBeNull();
    expect(placement().settle?.key).toBe(to);
    expect(plan().planned).toBe(313);
    expect(view().selected).toBe(to);
    expect(view().toast).toMatchObject({ undo: true });
    expect(plan().activity.at(-1)?.text).toBe(`Placed ${c.id} at ${to}`);

    undoLast();
    expect(plan().planned).toBe(312);
    expect(view().toast).toMatchObject({
      kind: 'info',
      title: 'Undone',
      message: `Placed ${c.id} at ${to}`,
    });
    expect(plan().activity.at(-1)?.text).toBe(`Undid: Placed ${c.id} at ${to}`);
    redoLast();
    expect(plan().planned).toBe(313);
    expect(view().toast).toMatchObject({ title: 'Redone' });
  });

  it('a refused pointer drop shakes the slot, shows the reason and returns the container (AT-02, FR-35)', () => {
    dispatch({ type: 'pickFromList', containerId: 'NSPU 551208 4', via: 'pointer' });
    dispatch({ type: 'hover', key: '180688' });
    dispatch({ type: 'drop' });
    expect(placement().placement.kind).toBe('idle');
    expect(placement().shake?.key).toBe('180688');
    expect(view().toast).toMatchObject({
      kind: 'err',
      title: "Can't place NSPU 551208 4 at 180688",
      message: 'Stack limit: 96.4 t of 90.0 t. Container returned to the load list.',
    });
    expect(plan().planned).toBe(312);
    expect(plan().history).toHaveLength(0);
  });

  it('places the ticked rows one after another (FR-39)', () => {
    const ticked = plan()
      .loadList.filter(
        (c) =>
          !plan().state.slotOf.has(c.id) && c.lengthFt === 40 && c.type !== 'RF' && !c.imdgClass,
      )
      .slice(0, 3)
      .map((c) => c.id);
    resetViewStore(ticked);
    pickFromList(ticked[0]!, 'keyboard');
    const p = placement().placement;
    expect(p.kind === 'over' && p.queue).toEqual(ticked.slice(1));
    // Placing it picks up the next, held over a free target of the plan after the placement.
    dispatch({ type: 'drop' });
    expect(plan().planned).toBe(313);
    const q2 = placement().placement;
    expect(q2.kind === 'over' && q2.source.containerId).toBe(ticked[1]);
    expect(q2.kind === 'over' && plan().state.placements.has(q2.target)).toBe(false);
    expect(view().announcement).toMatch(
      new RegExp(`Picked up ${ticked[1]}\\. 1 more row selected\\.$`),
    );
    dispatch({ type: 'cancel' });
    // From the middle row, the queue wraps around.
    resetPlanStore();
    resetViewStore(ticked);
    resetPlacementStore();
    pickFromList(ticked[1]!, 'pointer');
    const q = placement().placement;
    expect(q.kind !== 'idle' && q.kind !== 'swapping' && q.queue).toEqual([ticked[2], ticked[0]]);
  });

  it('a row that is not selected brings no queue', () => {
    pickFromList(plain40().id, 'pointer');
    const p = placement().placement;
    expect(p.kind === 'holding' && p.queue).toEqual([]);
  });

  it('cancel puts the held container back and clears the timing', () => {
    pickFromList(plain40().id, 'pointer');
    dispatch({ type: 'cancel' });
    expect(placement()).toMatchObject({ placement: { kind: 'idle' }, pickedAt: null });
    expect(view().announcement).toBe('Cancelled. Container returned to the load list.');
  });
});
