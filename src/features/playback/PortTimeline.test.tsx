// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewStore } from '@/state/view-store';
import { resetStores } from '@/test/render';
import { liftDuration, REST_MS } from './model';
import { PortTimeline } from './PortTimeline';

beforeEach(() => {
  resetStores();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const view = () => useViewStore.getState();

describe('PortTimeline (FR-55, FR-56)', () => {
  it('opens on Colombo in the 3D view and shows each stop with its counts (AT-07)', () => {
    act(() => view().openPlayback());
    render(<PortTimeline />);
    expect(view()).toMatchObject({ centerTab: '3d', playback: { port: 1, playing: true } });
    expect(
      screen.getByRole('button', { name: 'Colombo, 562 containers discharged, 2 restows' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(
      screen.getByRole('button', { name: 'Jebel Ali, 674 containers discharged, 1 restow' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 restows')).toBeInTheDocument();
    expect(screen.getByText('1 restow')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Port playback' })).toHaveAttribute(
      'aria-valuetext',
      'Colombo · discharging 562 boxes · 2 restow moves',
    );
  });

  it('Play steps through the ports after each lift, and stops at the last', () => {
    act(() => view().openPlayback());
    render(<PortTimeline />);
    act(() => void vi.advanceTimersByTime(liftDuration(562, false) + REST_MS));
    expect(view().playback?.port).toBe(2);
    act(() => void vi.advanceTimersByTime(liftDuration(674, false) + REST_MS));
    act(() => void vi.advanceTimersByTime(liftDuration(837, false) + REST_MS));
    expect(view().playback?.port).toBe(4);
    act(() => void vi.advanceTimersByTime(liftDuration(667, false) + REST_MS));
    expect(view().playback).toEqual({ port: 4, playing: false });
    // Play again starts from the first port.
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(view().playback).toEqual({ port: 1, playing: true });
  });

  it('pauses, steps and jumps from the buttons and the keyboard', () => {
    act(() => view().openPlayback());
    render(<PortTimeline />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(view().playback).toEqual({ port: 1, playing: false });
    fireEvent.click(screen.getByRole('button', { name: 'Next port' }));
    expect(view().playback?.port).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Previous port' }));
    expect(view().playback?.port).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /^Hamburg/ }));
    expect(view().playback?.port).toBe(4);
    const slider = screen.getByRole('slider', { name: 'Port playback' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '3');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '4');
  });

  it('closes back to the tab it came from', () => {
    view().setCenterTab('bay');
    act(() => view().openPlayback());
    act(() => view().closePlayback());
    expect(view()).toMatchObject({ playback: null, centerTab: 'bay' });
  });
});
