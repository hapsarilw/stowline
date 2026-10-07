// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { resetStores } from '@/test/render';
import { Inspector } from './Inspector';
import { buildInspector, formatSetPoint } from './model';

beforeEach(resetStores);

const model = (key: string) => {
  const { ctx, state, violations } = usePlanStore.getState();
  return buildInspector(ctx, state, violations, key);
};
const check = (key: string, rule: string) => model(key)!.checks.find((c) => c.rule === rule)!;

describe('Inspector model (FR-46, FR-47)', () => {
  it('describes NSPU 482913 5 as in design 01', () => {
    const m = model('180486')!;
    expect(m).toMatchObject({ id: 'NSPU 482913 5', iso: '45G1', weight: '28.4', locked: false });
    expect(m.status).toEqual({ text: '1 error', tone: 'error' });
    expect(m.fields.map((f) => [f.label, f.value])).toEqual([
      ['Type', '40HC · 9\'6"'],
      ['ISO code', '45G1'],
      ['VGM', '28.4 t'],
      ['POL', 'SGSIN'],
      ['POD', 'NLRTM · Rotterdam'],
      ['Reefer', 'No'],
      ['Dangerous goods', 'None'],
      ['Status', 'Planned this call'],
    ]);
    expect(m.slot).toEqual({
      title: 'Slot 180486',
      note: 'No plug',
      parts: [
        { value: '18', label: 'Bay · 40ft' },
        { value: '04', label: 'Row · Port' },
        { value: '86', label: 'Tier · Deck' },
      ],
    });
    expect(m.stack.label).toBe('Stack 18-04 deck');
    expect(m.stack.text).toBe('96.4 / 90.0 t');
    expect(m.stack.tone).toBe('err');
    expect(m.stack.limitPercent).toBeLessThan(m.stack.percent);
    expect(m.checks.map((c) => [c.name, c.tone, c.text])).toEqual([
      ['Stack weight', 'error', '96.4 / 90.0 t'],
      ['Reefer power', 'na', 'n/a'],
      ['DG segregation', 'na', 'n/a'],
      ['Overstow', 'ok', 'OK'],
      ['20/40 stacking', 'ok', 'OK'],
      ['Weight order', 'ok', 'OK'],
    ]);
  });

  it('gives the result of each rule: pass, warning, error or not applicable', () => {
    expect(check('220610', 'reefer')).toMatchObject({ tone: 'error', text: 'No plug' });
    expect(check('140284', 'dg')).toMatchObject({ tone: 'error', text: 'Too close' });
    expect(check('100382', 'overstow')).toMatchObject({ tone: 'error', text: '2 restows' });
    expect(check('420882', 'overstow')).toMatchObject({ tone: 'error', text: '1 restow' });
    expect(check('460612', 'heavy')).toMatchObject({ tone: 'warning', text: '+21.8 t' });
    expect(model('460612')!.status).toEqual({ text: '1 warning', tone: 'warning' });
    expect(check('290284', 'twenty')).toMatchObject({ tone: 'error', text: 'On 40ft' });
    expect(model('290284')!.slot.parts[0]).toEqual({ value: '29', label: 'Bay · 20ft' });
    expect(model('290284')!.stack.label).toBe('Stack 30-02 deck');
  });

  it('passes a container with a plug, and a container with no problem', () => {
    const { state } = usePlanStore.getState();
    const rf = [...state.placements.values()].find(
      (p) =>
        usePlanStore.getState().ctx.containers.get(p.containerId)?.type === 'RF' &&
        usePlanStore.getState().ctx.geometry.hasPlug(p.slotKey),
    )!;
    expect(check(rf.slotKey, 'reefer')).toMatchObject({ tone: 'ok', text: 'Plug OK' });
    expect(model(rf.slotKey)!.fields[5]!.value).toBe('−18.0 °C');
  });

  it('shows dangerous goods, locked and onboard containers', () => {
    expect(model('140484')!.fields[6]!.value).toBe('IMDG 5.1');
    expect(model('180202')!.locked).toBe(true);
    const onboard = [...usePlanStore.getState().state.placements.values()].find(
      (p) => p.origin === 'onboard',
    )!;
    expect(model(onboard.slotKey)!.fields[7]!.value).toBe('Onboard from IDJKT');
  });

  it('has nothing to show for an empty slot or no selection', () => {
    const { ctx, state } = usePlanStore.getState();
    const empty = ctx.geometry.slots40().find((k) => !state.placements.has(k))!;
    expect(model(empty)).toBeNull();
    expect(
      buildInspector(usePlanStore.getState().ctx, usePlanStore.getState().state, [], null),
    ).toBeNull();
  });

  it('formats set points', () => {
    expect(formatSetPoint(-18)).toBe('−18.0 °C');
    expect(formatSetPoint(4)).toBe('+4.0 °C');
  });
});

describe('Inspector', () => {
  it('shows the selected container, its rule checks and read-only actions', () => {
    render(<Inspector />);
    expect(screen.getByText('NSPU 482913 5')).toBeInTheDocument();
    expect(screen.getByText('1 error')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(list)
        .getAllByRole('img')
        .map((i) => i.getAttribute('aria-label')),
    ).toEqual(['Error', 'Not applicable', 'Not applicable', 'Pass', 'Pass', 'Pass']);
    for (const name of [/^Unplace/, /^Lock/, /^Swap/])
      expect(screen.getByRole('button', { name })).toBeDisabled();
  });

  it('follows the selection and says when nothing is selected', () => {
    render(<Inspector />);
    act(() => useViewStore.getState().select('460612'));
    expect(screen.getByText('NSPU 813350 9')).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
    act(() => useViewStore.getState().select(null));
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('marks a locked container', () => {
    render(<Inspector />);
    act(() => useViewStore.getState().select('180202'));
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
