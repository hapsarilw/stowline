// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { resetStores } from '@/test/render';
import { ErrorBoundary } from './ErrorBoundary';
import { Hints, Legend, Toolbar, TooltipBox } from './Overlays';
import { showTooltip, tooltipInfo } from './scene/Picking';
import { Skeleton, Unavailable, Viewport3D } from './Viewport3D';
import { hasWebGL2, resetWebGLCheck } from './webgl';

beforeEach(() => {
  resetStores();
  resetWebGLCheck();
});

describe('Viewport3D shell', () => {
  it('without WebGL 2 shows the message and opens the bay view (FR-24)', async () => {
    expect(hasWebGL2()).toBe(false); // jsdom has no WebGL
    render(<Viewport3D />);
    const region = screen.getByRole('region', { name: '3D view' });
    expect(within(region).getByText('3D view unavailable')).toBeInTheDocument();
    expect(
      within(region).getByText(/WebGL couldn't start\. The bay grid still has every action\./),
    ).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('button', { name: 'Open bay view' }));
    expect(useViewStore.getState().centerTab).toBe('bay');
  });

  it('shows the loading skeleton with the container count (FR-25)', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading vessel geometry and 2,740 containers…',
    );
  });

  it('says when the 3D view stopped working', () => {
    render(<Unavailable reason="error" />);
    expect(screen.getByText(/The 3D view stopped working\./)).toBeInTheDocument();
  });

  it('keeps an error in the 3D view inside the view (NFR-17)', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    let caught: unknown;
    const original = console.error;
    console.error = () => undefined;
    render(
      <ErrorBoundary fallback={<span>fallback</span>} onError={(e) => (caught = e)}>
        <Boom />
      </ErrorBoundary>,
    );
    console.error = original;
    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect((caught as Error).message).toBe('boom');
  });
});

describe('3D toolbar (FR-19 to FR-21)', () => {
  it('asks for a camera preset, again even when it is the same one', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const iso = screen.getByRole('button', { name: 'Iso' });
    expect(iso).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Top' }));
    expect(useViewStore.getState().camera).toEqual({ preset: 'top', seq: 1, bay: null });
    expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Top' }));
    expect(useViewStore.getState().camera.seq).toBe(2);
    expect(screen.getByRole('button', { name: 'Stbd' })).toHaveAttribute('title', 'From starboard');
  });

  it('switches color mode, hull transparency and the POD filter', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole('button', { name: 'Weight' }));
    expect(useViewStore.getState().colorMode).toBe('weight');
    const hull = screen.getByRole('button', { name: /Hull/ });
    expect(hull).toHaveTextContent('20%');
    await user.click(hull);
    expect(useViewStore.getState().hullTransparent).toBe(false);
    expect(screen.getByRole('button', { name: /Hull/ })).toHaveTextContent('Solid');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show only containers for port' }),
      'NLRTM',
    );
    expect(useViewStore.getState().onlyPod).toBe('NLRTM');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show only containers for port' }),
      '',
    );
    expect(useViewStore.getState().onlyPod).toBeNull();
  });
});

describe('3D legend (FR-20)', () => {
  it('counts containers per POD as in design 01', () => {
    render(<Legend />);
    const legend = screen.getByRole('group', { name: 'Legend: Port of discharge' });
    expect(legend).toHaveTextContent('CMB562JEA674RTM837HAM667');
  });

  it('follows the color mode', () => {
    render(<Legend />);
    act(() => useViewStore.getState().setColorMode('viol'));
    expect(screen.getByRole('group', { name: 'Legend: Rule status' })).toHaveTextContent(
      'Error6Warning1Clear',
    );
    act(() => useViewStore.getState().setColorMode('type'));
    expect(screen.getByRole('group', { name: 'Legend: Container type' })).toHaveTextContent('40HC');
  });

  it('shows the hints', () => {
    render(<Hints />);
    expect(screen.getByText('Drag to orbit')).toBeInTheDocument();
  });
});

describe('hover tooltip (FR-22)', () => {
  it('describes a container: ID, slot, type, weight, POD and its violation', () => {
    expect(tooltipInfo('180486')).toEqual({
      id: 'NSPU 482913 5',
      line: '180486 · 40HC · 28.4 t',
      pod: 'RTM',
      podCode: 'NLRTM',
      podName: 'Rotterdam',
      violation: 'Stack 18-04 deck: 96.4 t of 90.0 t limit',
    });
    expect(tooltipInfo('020100')).toBeNull();
  });

  it('fills, places and hides the tooltip without React', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <div>
        <TooltipBox ref={(el) => void (ref.current = el)} />
      </div>,
    );
    const el = ref.current!;
    expect(el.hidden).toBe(true);
    showTooltip(el, tooltipInfo('460610'), 100, 50);
    expect(el.hidden).toBe(false);
    expect(el).toHaveTextContent('NSPU 640033 2');
    expect(el).toHaveTextContent('Heavy over light');
    expect(el.style.transform).toContain('translate(');
    showTooltip(el, tooltipInfo('180102'), 10, 10);
    expect(el.querySelector('[data-field="violation"]')).toHaveProperty('hidden', true);
    showTooltip(el, null, 0, 0);
    expect(el.hidden).toBe(true);
    showTooltip(null, null, 0, 0);
    void usePlanStore;
  });
});
