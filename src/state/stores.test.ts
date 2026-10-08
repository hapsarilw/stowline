// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAll } from '@/domain';
import { runValidation } from './actions';
import { resetPlanStore, usePlanStore } from './plan-store';
import {
  initialView,
  readStoredTheme,
  resetViewStore,
  SPLIT_MAX,
  SPLIT_MIN,
  useViewStore,
} from './view-store';

const plan = () => usePlanStore.getState();
const view = () => useViewStore.getState();

beforeEach(() => {
  localStorage.clear();
  resetPlanStore();
  resetViewStore();
});

const plain40 = () =>
  plan().loadList.filter(
    (c) => !plan().state.slotOf.has(c.id) && c.lengthFt === 40 && c.type !== 'RF' && !c.imdgClass,
  );
const freeSlot = (bay: number) =>
  plan()
    .ctx.geometry.slots40()
    .find((k) => !plan().state.placements.has(k) && k.endsWith('82') && +k.slice(0, 2) === bay)!;

describe('plan store', () => {
  it('starts as the seeded plan', () => {
    expect(plan().planned).toBe(312);
    expect(plan().violations).toHaveLength(7);
    expect(plan().violations).toEqual(validateAll(plan().state, plan().ctx));
    expect(plan().header).toMatchObject({ id: '042W-SGSIN', status: 'draft', version: 14 });
    expect(plan().stability.gm).toBeCloseTo(1.84, 6);
    expect(plan().violationIndex.byBay.get(18)).toBe(1);
  });

  it('applies a command, re-checks the touched stacks and keeps history', () => {
    const c = plain40()[0]!;
    const r = plan().apply({ kind: 'place', containerId: c.id, to: freeSlot(86) });
    expect(r.ok).toBe(true);
    expect(plan().planned).toBe(313);
    expect(plan().history).toHaveLength(1);
    expect(plan().violations).toEqual(validateAll(plan().state, plan().ctx));
    expect(plan().stability.displacementT).toBeGreaterThan(98420);
  });

  it('refuses a command that creates an error and changes nothing', () => {
    const c = plan().loadList.find((x) => x.id === 'NSPU 551208 4')!;
    const before = plan().state;
    const r = plan().apply({ kind: 'place', containerId: c.id, to: '180688' });
    expect(r).toMatchObject({ ok: false, reason: 'Stack limit: 96.4 t of 90.0 t' });
    expect(plan().state).toBe(before);
    expect(plan().history).toHaveLength(0);
  });

  it('undoes and redoes, and a new command clears redo', () => {
    const [a, b] = plain40();
    expect(plan().undo()).toBe(false);
    expect(plan().redo()).toBe(false);
    plan().apply({ kind: 'place', containerId: a!.id, to: freeSlot(86) });
    const placed = plan().state;
    expect(plan().undo()).toBe(true);
    expect(plan().planned).toBe(312);
    expect(plan().future).toHaveLength(1);
    expect(plan().redo()).toBe(true);
    expect(plan().state.slotOf.get(a!.id)).toBe(placed.slotOf.get(a!.id));
    plan().undo();
    const again = plan().apply({ kind: 'place', containerId: b!.id, to: freeSlot(82) });
    expect(again.ok).toBe(true);
    expect(plan().future).toHaveLength(0);
    expect(plan().violations).toEqual(validateAll(plan().state, plan().ctx));
  });
});

describe('view store', () => {
  it('opens as the design does', () => {
    expect(view()).toMatchObject({
      centerTab: 'split',
      leftOpen: true,
      rightOpen: true,
      rightTab: 'inspector',
      bay: 18,
      half: 'both',
      selected: '180486',
      theme: 'dark',
    });
    expect(Object.keys(view().checked)).toHaveLength(3);
  });

  it('collapses both panels in the Bay tab, as screen 03, and restores them after', () => {
    view().setCenterTab('bay');
    expect(view()).toMatchObject({ centerTab: 'bay', leftOpen: false, rightOpen: false });
    view().setCenterTab('split');
    expect(view()).toMatchObject({ leftOpen: true, rightOpen: true });
    // Collapsed before: stays collapsed.
    view().toggleRight();
    view().setCenterTab('bay');
    view().setCenterTab('3d');
    expect(view()).toMatchObject({ leftOpen: true, rightOpen: false });
    // A panel opened in the Bay tab is kept as it is.
    view().setCenterTab('bay');
    view().toggleLeft();
    view().setCenterTab('split');
    expect(view()).toMatchObject({ leftOpen: true, rightOpen: false });
  });

  it('keeps the split inside its limits', () => {
    view().setSplitRatio(0.01);
    expect(view().splitRatio).toBe(SPLIT_MIN);
    view().setSplitRatio(0.99);
    expect(view().splitRatio).toBe(SPLIT_MAX);
  });

  it('keeps the same row and tier when the half view changes', () => {
    view().setBay(30, '300284');
    view().setHalf('fore');
    expect(view().focus).toBe('290284');
    view().setHalf('aft');
    expect(view().focus).toBe('310284');
    view().setHalf('both');
    expect(view().focus).toBe('300284');
    view().setHalf('both');
    expect(view().focus).toBe('300284');
  });

  it('selects, focuses and ticks', () => {
    view().select('460612', { bay: 46 });
    expect(view()).toMatchObject({ selected: '460612', focus: '460612', bay: 46 });
    view().setFocus('460610');
    expect(view().selected).toBe('460612');
    view().setFocus('460610', { select: true, announce: 'hello' });
    expect(view()).toMatchObject({ selected: '460610', announcement: 'hello' });
    view().toggleChecked('X');
    expect(view().checked.X).toBe(true);
    view().toggleChecked('X');
    expect(view().checked.X).toBeUndefined();
    view().setRightTab('violations');
    view().toggleRight();
    expect(view()).toMatchObject({ rightTab: 'violations', rightOpen: false });
  });

  it('shows a toast that goes away on its own', () => {
    vi.useFakeTimers();
    view().showToast({ kind: 'ok', title: 'Done' });
    expect(view().toast?.title).toBe('Done');
    vi.advanceTimersByTime(5300);
    expect(view().toast).toBeNull();
    view().showToast({ kind: 'err', title: 'Oops' });
    view().dismissToast();
    expect(view().toast).toBeNull();
    vi.useRealTimers();
  });

  it('remembers the theme, and copes with blocked storage', () => {
    view().toggleTheme();
    expect(readStoredTheme()).toBe('light');
    expect(initialView().theme).toBe('light');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredTheme()).toBe('dark');
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => view().setTheme('dark')).not.toThrow();
    set.mockRestore();
  });
});

describe('runValidation', () => {
  it('tells the user when the check cannot run', async () => {
    vi.resetModules();
    vi.doMock('@/worker/client', () => ({
      createValidationClient: () => ({
        api: { validate: () => Promise.reject(new Error('boom')) },
        terminate: () => undefined,
      }),
    }));
    const actions = await import('./actions');
    const views = await import('./view-store');
    await actions.runValidation();
    expect(views.useViewStore.getState().toast).toMatchObject({
      kind: 'err',
      title: 'Validation failed',
    });
    vi.doUnmock('@/worker/client');
    void runValidation;
  });
});
