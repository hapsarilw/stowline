// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { renderWorkspace, resetStores } from '@/test/render';
import { strengthChart } from './drawer';
import { StabilityDrawer } from './StabilityDrawer';

beforeEach(resetStores);

describe('StabilityDrawer (FR-53)', () => {
  it('opens from the Stability button and closes with it, the close button or Esc', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const button = screen.getByRole('button', { name: 'Stability' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'stability-drawer');
    expect(screen.getByRole('region', { name: 'Stability details' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close stability drawer' }));
    expect(screen.queryByRole('region', { name: 'Stability details' })).toBeNull();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Stability details' })).toBeNull();
  });

  it('draws the curves of the plan and shows the values of design 05', () => {
    act(() => useViewStore.getState().setDrawerOpen(true));
    render(<StabilityDrawer />);
    const { stability, ctx } = usePlanStore.getState();
    const chart = strengthChart(stability.bmCurve, stability.sfCurve, ctx, 18);
    expect(screen.getByTestId('bm-curve')).toHaveAttribute('d', chart.bmPath);
    expect(screen.getByTestId('sf-curve')).toHaveAttribute('d', chart.sfPath);
    expect(
      screen.getByRole('img', {
        name: 'Bending moment peaks at 78 percent, shear force at 64 percent of limit',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Draft forward 12.10 metres, aft 12.72 metres, 0.62 m by stern',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'GM 1.84 metres, minimum 1.20' })).toBeInTheDocument();
    expect(
      screen.getByText('Departure condition · SGSIN · draft plan, 312 of 1,240 loaded'),
    ).toBeInTheDocument();
    for (const t of [
      'OK · min 1.20 m',
      'Check · crane limit 0.3°',
      'OK · limit ±1.50 m',
      '98,420 t',
      '71,260 t',
      '17.46 m',
    ])
      expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('moves the band with the selected bay', () => {
    act(() => useViewStore.getState().setDrawerOpen(true));
    const { container } = render(<StabilityDrawer />);
    const band = () => Number(container.querySelector('rect')!.getAttribute('x'));
    const at18 = band();
    act(() => useViewStore.getState().setBay(62));
    expect(band()).toBeGreaterThan(at18);
  });
});
