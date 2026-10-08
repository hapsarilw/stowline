// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPlacementStore, dispatch } from './placement-store';
import { editGate } from './edit-gate';
import { resetPlanStore, usePlanStore } from './plan-store';
import { resetSessionStore, useSessionStore } from './session-store';
import { readUnsaved, writeUnsaved } from './unsaved';
import { resetViewStore, useViewStore } from './view-store';

beforeEach(() => {
  localStorage.clear();
  resetPlanStore();
  resetViewStore();
  resetPlacementStore();
  useSessionStore.setState({ role: 'planner' });
});

const plan = () => usePlanStore.getState();
const MOVE = { kind: 'move' as const, from: '180488', to: '180688' };

describe('unsaved commands (FR-61, NFR-16)', () => {
  it('writes and reads back, and clears when empty', () => {
    writeUnsaved('p', { baseVersion: 14, commands: [MOVE] });
    expect(readUnsaved('p')).toEqual({ baseVersion: 14, commands: [MOVE] });
    writeUnsaved('p', { baseVersion: 14, commands: [] });
    expect(readUnsaved('p')).toBeNull();
  });

  it('ignores a damaged value, and copes with blocked storage', () => {
    localStorage.setItem('stowline.unsaved.p', '{nope');
    expect(readUnsaved('p')).toBeNull();
    localStorage.setItem('stowline.unsaved.p', '{"baseVersion":"x"}');
    expect(readUnsaved('p')).toBeNull();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeUnsaved('p', { baseVersion: 1, commands: [MOVE] })).not.toThrow();
    spy.mockRestore();
  });

  it('every command is kept with the base version, and undo to nothing clears it', () => {
    plan().apply(MOVE);
    expect(readUnsaved('042W-SGSIN')).toEqual({ baseVersion: 14, commands: [MOVE] });
    plan().undo();
    expect(readUnsaved('042W-SGSIN')).toBeNull();
  });

  it('after a save the history starts again from the new version', () => {
    plan().apply(MOVE);
    plan().markSaved(15);
    expect(plan()).toMatchObject({
      baseVersion: 15,
      history: [],
      future: [],
      header: { version: 15 },
    });
    expect(readUnsaved('042W-SGSIN')).toBeNull();
    plan().apply({ kind: 'lock', at: '180688' });
    expect(readUnsaved('042W-SGSIN')?.baseVersion).toBe(15);
  });
});

describe('read only plans (FR-63)', () => {
  it('an approved plan refuses commands, undo and pick-up', () => {
    plan().apply(MOVE);
    plan().setStatus('approved', 14);
    expect(editGate.check('command').ok).toBe(false);
    expect(plan().apply({ kind: 'move', from: '180688', to: '180488' })).toMatchObject({
      ok: false,
      reason: 'This plan is approved and read only. Revise it to make changes.',
    });
    expect(plan().undo()).toBe(false);
    dispatch({ type: 'pickFromSlot', key: '180486', via: 'keyboard' });
    expect(useViewStore.getState().announcement).toBe(
      '180486: NSPU 482913 5, Rotterdam, 28.4 t. This plan is approved and read only. Revise it to make changes.',
    );
  });

  it('a read only role cannot change a draft', () => {
    useSessionStore.getState().setRole('terminal');
    expect(editGate.check('command').ok).toBe(false);
    expect(plan().apply(MOVE).ok).toBe(false);
    dispatch({ type: 'pickFromSlot', key: '180486', via: 'keyboard' });
    expect(useViewStore.getState().announcement).toBe(
      '180486: NSPU 482913 5, Rotterdam, 28.4 t. Your role cannot change plans.',
    );
  });

  it('keeps the role in the browser, and copes with a bad stored value', () => {
    useSessionStore.getState().setRole('senior');
    expect(localStorage.getItem('stowline.role')).toBe('senior');
    localStorage.setItem('stowline.role', 'admin');
    resetSessionStore();
    expect(useSessionStore.getState().role).toBe('planner');
  });
});

describe('import adds to the load list', () => {
  it('puts new rows on the list, and they can be placed', () => {
    const c = {
      id: 'NSPU 900000 1',
      type: '40GP' as const,
      isoCode: '42G1',
      lengthFt: 40 as const,
      weightT: 8,
      pol: 'SGSIN',
      pod: 'LKCMB',
    };
    plan().addToLoadList([c]);
    expect(plan().loadList).toHaveLength(1241);
    expect(plan().ctx.containers.get(c.id)).toEqual(c);
    expect(plan().apply({ kind: 'place', containerId: c.id, to: '180286' }).ok).toBe(true);
    expect(plan().planned).toBe(313);
  });
});
