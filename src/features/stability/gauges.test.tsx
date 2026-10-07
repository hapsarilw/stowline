// @vitest-environment jsdom
import { act, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_LIMITS } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { resetStores } from '@/test/render';
import { buildGauges, type StabilityValues } from './gauges';
import { StabilityStrip } from './StabilityStrip';
import { useTween } from './useTween';

const seeded: StabilityValues = { gm: 1.84, trim: 0.62, list: 0.4, bmPct: 78, sfPct: 64 };
const gauges = (v: Partial<StabilityValues> = {}) => {
  const values = { ...seeded, ...v };
  return buildGauges(values, values, SAMPLE_LIMITS);
};
const get = (key: string, v: Partial<StabilityValues> = {}) =>
  gauges(v).find((g) => g.key === key)!;

describe('gauge model (FR-50)', () => {
  it('reads as in the design for the seeded plan', () => {
    const g = gauges();
    expect(g.map((x) => [x.label, x.value, x.unit, x.stateText])).toEqual([
      ['GM', '1.84', 'm · min 1.20', 'OK'],
      ['Trim', '0.62', 'm by stern', 'OK'],
      ['List', '0.4', '° to port', 'Check'],
      ['BM / SF', '78 / 64', '% of limit', 'OK'],
    ]);
    expect(g.map((x) => x.mark.toFixed(1))).toEqual(['61.3', '70.7', '40.0', '78.0']);
  });

  it('GM: Limit under 1.20, Check under 1.40', () => {
    expect(get('gm', { gm: 1.2 }).stateText).toBe('Check');
    expect(get('gm', { gm: 1.12 }).stateText).toBe('Limit');
    expect(get('gm', { gm: 1.39 }).stateText).toBe('Check');
    expect(get('gm', { gm: 1.4 }).stateText).toBe('OK');
  });

  it('trim counts both directions and names the end that is down', () => {
    expect(get('trim', { trim: -1.2 })).toMatchObject({
      value: '1.20',
      unit: 'm by head',
      stateText: 'Check',
    });
    expect(get('trim', { trim: 1.6 }).stateText).toBe('Limit');
    expect(get('trim', { trim: 0 }).mark).toBe(50);
  });

  it('list counts both sides and names the side', () => {
    expect(get('list', { list: -0.5 })).toMatchObject({
      value: '0.5',
      unit: '° to stbd',
      stateText: 'Check',
    });
    expect(get('list', { list: 2 }).stateText).toBe('Limit');
    expect(get('list', { list: 0.3 }).stateText).toBe('OK');
  });

  it('BM / SF takes the worse of the two', () => {
    expect(get('strength', { sfPct: 90 }).stateText).toBe('Check');
    expect(get('strength', { bmPct: 101 }).stateText).toBe('Limit');
    expect(get('strength', { bmPct: 150 }).mark).toBe(100);
  });

  it('shows the drag preview and takes the state from the plan, not the numbers on screen', () => {
    const g = buildGauges({ ...seeded, gm: 1.5 }, seeded, SAMPLE_LIMITS, { trim: '+0.04 m' });
    expect(g.find((x) => x.key === 'trim')?.delta).toBe('+0.04 m');
    expect(g[0]).toMatchObject({ value: '1.50', stateText: 'OK' });
  });
});

describe('StabilityStrip', () => {
  beforeEach(resetStores);

  it('always shows four gauges, each with a state icon and text (NFR-12)', () => {
    render(<StabilityStrip />);
    const group = (name: RegExp) => screen.getByRole('group', { name });
    expect(group(/^GM 1\.84 m · min 1\.20, OK$/)).toBeInTheDocument();
    expect(group(/^Trim 0\.62 m by stern, OK$/)).toBeInTheDocument();
    expect(group(/^List 0\.4 ° to port, Check$/)).toBeInTheDocument();
    expect(group(/^BM \/ SF 78 \/ 64 % of limit, OK$/)).toBeInTheDocument();
    for (const g of screen.getAllByRole('group')) expect(g.querySelector('svg')).not.toBeNull();
    expect(within(group(/^List/)).getByText('Check')).toBeInTheDocument();
  });

  it('follows the plan', () => {
    render(<StabilityStrip />);
    const before = usePlanStore.getState().stability.gm;
    expect(before).toBeCloseTo(1.84, 6);
    act(() => {
      usePlanStore.setState({ stability: { ...usePlanStore.getState().stability, gm: 1.1 } });
    });
    return vi.waitFor(() =>
      expect(
        screen.getByRole('group', { name: /^GM 1\.10 m · min 1\.20, Limit$/ }),
      ).toBeInTheDocument(),
    );
  });
});

describe('useTween (FR-52, FR-66)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts to the new value over 300 ms', async () => {
    const { result, rerender } = renderHook(({ v }) => useTween(v), {
      initialProps: { v: [0, 10] },
    });
    expect(result.current).toEqual([0, 10]);
    rerender({ v: [10, 20] });
    await vi.waitFor(() => expect(result.current[0]).toBeGreaterThan(0));
    expect(result.current[0]).toBeLessThan(10);
    await vi.waitFor(() => expect(result.current).toEqual([10, 20]), { timeout: 1000 });
  });

  it('jumps at once with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result, rerender } = renderHook(({ v }) => useTween(v), { initialProps: { v: [1] } });
    rerender({ v: [5] });
    expect(result.current).toEqual([5]);
  });
});
