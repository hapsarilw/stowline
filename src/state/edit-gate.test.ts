// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDIT_ACTIONS, type EditAction } from '@/domain';
import { beginDrag } from '@/features/workspace/drag';
import { applyFix } from './actions';
import { api } from './api';
import { editGate } from './edit-gate';
import { importLoadListFile } from './import';
import {
  dispatch,
  redoLast,
  resetPlacementStore,
  runCommand,
  undoLast,
  usePlacementStore,
} from './placement-store';
import { resetPlanStore, usePlanStore } from './plan-store';
import { saveCurrent } from './save';
import { useSessionStore } from './session-store';
import { resetViewStore, useViewStore } from './view-store';
import { revise } from './workflow';

// The gate proof (M8): every edit path asks the one gate, with its own action, before it acts.
// Each path runs as the Terminal planner (read only) and must ask, and change nothing: not the
// plan, not the placement, and no request leaves.

const MOVE = { kind: 'move' as const, from: '180488', to: '180688' };
const plan = () => usePlanStore.getState();

let asked: EditAction[];
let requests: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  localStorage.clear();
  resetPlanStore();
  resetViewStore();
  resetPlacementStore();
  // One unsaved change made as the vessel planner, and one undone, so Undo and Redo have work.
  useSessionStore.setState({ role: 'planner' });
  expect(plan().apply(MOVE).ok).toBe(true);
  expect(plan().apply({ kind: 'unplace', from: '220610' }).ok).toBe(true);
  expect(plan().undo()).toBe(true);
  useSessionStore.getState().setRole('terminal');
  asked = [];
  const real = editGate.check.bind(editGate);
  vi.spyOn(editGate, 'check').mockImplementation((a) => {
    asked.push(a);
    return real(a);
  });
  requests = [
    vi.spyOn(api, 'savePlan'),
    vi.spyOn(api, 'importLoadList'),
    vi.spyOn(api, 'setStatus'),
    vi.spyOn(api, 'getPlan'),
  ];
});

afterEach(() => vi.restoreAllMocks());

const snapshot = () => ({
  state: plan().state,
  history: plan().history.length,
  future: plan().future.length,
  loadList: plan().loadList.length,
  placement: usePlacementStore.getState().placement.kind,
});

const pointer = (x = 10, y = 10) =>
  ({ button: 0, clientX: x, clientY: y }) as unknown as PointerEvent;

/** Every edit path, by the action it must ask for. */
const PATHS: Record<EditAction, () => unknown> = {
  command: () => runCommand({ kind: 'unplace', from: '220610' }),
  drag: () => {
    beginDrag(pointer(), { kind: 'list', containerId: plan().loadList[0]!.id }, document.body);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }));
  },
  pickUp: () => dispatch({ type: 'pickFromSlot', key: '180688', via: 'keyboard' }),
  applyFix: () => applyFix(plan().violations[0]!.id),
  import: () => importLoadListFile(new File(['[]'], 'load-list.json')),
  save: () => saveCurrent(),
  undo: () => undoLast(),
  redo: () => redoLast(),
  revise: () => revise(),
};

describe('every edit path asks canEdit (M8 gate)', () => {
  it('there is one path for each edit action', () => {
    expect(Object.keys(PATHS).sort()).toEqual([...EDIT_ACTIONS].sort());
  });

  it.each([...EDIT_ACTIONS])(
    '%s: asks the gate for that action and changes nothing when read only',
    async (action) => {
      const before = snapshot();
      await PATHS[action]();
      expect(asked).toContain(action);
      expect(snapshot()).toEqual(before);
      for (const r of requests) expect(r).not.toHaveBeenCalled();
      // The reason is said: in the live region, or in the message a refused command shows.
      const v = useViewStore.getState();
      expect(`${v.announcement} ${v.toast?.message ?? ''}`).toMatch(
        action === 'revise'
          ? /Only an approved plan can be revised\./
          : /Your role cannot change plans\./,
      );
    },
  );

  it('a drag of a bay cell is a drag too', () => {
    beginDrag(pointer(), { kind: 'slot', key: '180486' }, document.body);
    expect(asked).toContain('drag');
    expect(usePlacementStore.getState().placement.kind).toBe('idle');
  });

  it('the same paths work for an editing role (the gate says yes)', () => {
    useSessionStore.getState().setRole('planner');
    dispatch({ type: 'pickFromSlot', key: '180688', via: 'keyboard' });
    expect(asked).toContain('pickUp');
    expect(usePlacementStore.getState().placement.kind).not.toBe('idle');
  });
});

describe('switching role (decision 1, design 09)', () => {
  it('takes effect at once, keeps the unsaved commands, and puts a held container back', () => {
    useSessionStore.getState().setRole('planner');
    dispatch({ type: 'pickFromSlot', key: '180688', via: 'keyboard' });
    expect(usePlacementStore.getState().placement.kind).not.toBe('idle');
    const unsaved = plan().history.length;
    useSessionStore.getState().setRole('officer');
    expect(usePlacementStore.getState().placement.kind).toBe('idle');
    expect(plan().history.length).toBe(unsaved);
    expect(editGate.check('command').ok).toBe(false);
    useSessionStore.getState().setRole('senior');
    expect(editGate.check('command').ok).toBe(true);
    expect(plan().history.length).toBe(unsaved);
  });
});
