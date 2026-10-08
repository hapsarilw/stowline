// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { renderWorkspace, resetStores } from '@/test/render';
import { validationApi } from '@/worker/validation-api';

// The real worker needs a browser. Here the same function runs on the main thread.
vi.mock('@/worker/client', () => ({
  createValidationClient: () => ({ api: validationApi, terminate: () => undefined }),
}));

beforeEach(resetStores);

describe('shell (FR-06 to FR-09)', () => {
  it('shows every part on one screen with the design copy', () => {
    renderWorkspace();
    expect(screen.getByRole('banner', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Load list' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Plan workspace' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bay navigator' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Stability' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '3D view' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bay view' })).toBeInTheDocument();
  });

  it('has side panels fixed at 320 px that collapse to 40 px rails (FR-06, FR-07)', async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.style.gridTemplateColumns).toBe('320px minmax(0,1fr) 320px');
    await user.click(screen.getByRole('button', { name: 'Collapse load list' }));
    await user.click(screen.getByRole('button', { name: 'Collapse panel' }));
    expect(shell.style.gridTemplateColumns).toBe('40px minmax(0,1fr) 40px');
    expect(screen.getByText(/Violations · 7/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand details panel' }));
    await user.click(screen.getByRole('button', { name: 'Expand load list' }));
    expect(shell.style.gridTemplateColumns).toBe('320px minmax(0,1fr) 320px');
  });

  it('switches the center between 3D, Bay and Split (FR-08)', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(tab('Split')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: '3D view' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bay view' })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    await user.click(tab('3D'));
    expect(screen.queryByRole('region', { name: 'Bay view' })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    await user.click(tab('Bay'));
    expect(screen.queryByRole('region', { name: '3D view' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bay view' })).toBeInTheDocument();
  });

  it('moves between view tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    screen.getByRole('tab', { name: 'Split' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '3D' })).toHaveFocus();
    expect(useViewStore.getState().centerTab).toBe('3d');
    await user.keyboard('{End}');
    expect(useViewStore.getState().centerTab).toBe('split');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(useViewStore.getState().centerTab).toBe('split');
  });

  it('resizes the split with the keyboard, within limits', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const bar = screen.getByRole('separator', { name: 'Resize 3D and bay view' });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    bar.focus();
    await user.keyboard('{ArrowDown}');
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(bar).toHaveAttribute('aria-valuenow', '58');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(bar).toHaveAttribute('aria-valuenow', '48');
    await user.keyboard('{Home}');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    await user.keyboard('{End}');
    expect(bar).toHaveAttribute('aria-valuenow', '80');
    await user.keyboard('{Tab}');
  });

  it('resizes the split by dragging', () => {
    renderWorkspace();
    const bar = screen.getByRole('separator');
    const area = bar.parentElement!;
    area.getBoundingClientRect = () => ({
      top: 100,
      height: 500,
      bottom: 600,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    act(() => {
      bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      bar.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 350 }));
    });
    expect(useViewStore.getState().splitRatio).toBeCloseTo(0.5, 2);
    act(() => {
      bar.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      bar.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 150 }));
    });
    expect(useViewStore.getState().splitRatio).toBeCloseTo(0.5, 2);
  });

  it('shows a message for a plan that does not exist', () => {
    renderWorkspace('/plans/nope');
    expect(screen.getByRole('heading', { name: 'Plan not found' })).toBeInTheDocument();
  });

  it('focuses the load list search with "/"', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('tab', { name: 'Bay' }));
    await user.keyboard('/');
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Search load list' })).toHaveFocus(),
    );
  });

  it('switches the tabs of the details panel (FR-46)', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'details-panel-inspector');
    await user.click(screen.getByRole('tab', { name: /Violations/ }));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'details-panel-violations');
    expect(screen.getByRole('tab', { name: /Violations/ })).toHaveAccessibleName(
      'Violations 7 violations',
    );
  });
});

describe('TopBar (FR-09, FR-11)', () => {
  it('shows vessel, voyage, rotation, status and planned count', () => {
    renderWorkspace();
    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('MV Nusantara Pioneer')).toBeInTheDocument();
    expect(within(bar).getByText('Voy 042W · 8,500 TEU')).toBeInTheDocument();
    // Two lists: the compact one under 1600 px and the full one, shown by CSS.
    const [compact, rotation] = within(bar).getAllByRole('list', { name: 'Port rotation' });
    expect(
      within(compact!)
        .getAllByRole('listitem')
        .map((li) =>
          li.textContent
            ?.replace(/,.*$/, '')
            .replace(/Now$/, '')
            .replace(/^\+3.*/, '+3'),
        ),
    ).toEqual(['SGSIN', 'LKCMB', '+3']);
    expect(
      within(rotation!)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.replace(/,.*$/, '').replace(/Now$/, '')),
    ).toEqual(['IDJKT', 'SGSIN', 'LKCMB', 'AEJEA', 'NLRTM', 'DEHAM'].map((c) => c));
    expect(within(rotation!).getByText('SGSIN').closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(within(bar).getByText('Draft')).toBeInTheDocument();
    expect(within(bar).getByText('312')).toBeInTheDocument();
    expect(bar).toHaveTextContent('/ 1,240 planned');
    const progress = within(bar).getByRole('progressbar', { name: 'Plan progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '25.2');
  });

  it('has Undo and Redo off until there is something to undo', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    const { state } = usePlanStore.getState();
    const loose = usePlanStore
      .getState()
      .loadList.find((c) => !state.slotOf.has(c.id) && c.lengthFt === 40)!;
    act(() => {
      const r = usePlanStore
        .getState()
        .apply({ kind: 'place', containerId: loose.id, to: freeSlot() });
      expect(r.ok).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByText('313')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(usePlanStore.getState().planned).toBe(313);
    await user.keyboard('{Control>}z{/Control}');
    expect(usePlanStore.getState().planned).toBe(312);
  });

  it('switches the theme and remembers it (FR-11)', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(useViewStore.getState().theme).toBe('light');
    expect(localStorage.getItem('stowline.theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(localStorage.getItem('stowline.theme')).toBe('dark');
  });

  it('runs Validate in the worker and reports errors and warnings (FR-41)', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /^Validate/ }));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Validation complete · 7 issues');
    expect(toast).toHaveTextContent(
      "6 errors, 1 warning. Plan can't be approved while errors remain.",
    );
    expect(usePlanStore.getState().violations).toHaveLength(7);
    await user.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has Save off until there is something to save, and Import load list on for a planner', () => {
    renderWorkspace();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import load list' })).toBeEnabled();
  });
});

function freeSlot(): string {
  const { ctx, state } = usePlanStore.getState();
  return ctx.geometry
    .slots40()
    .find(
      (k) =>
        !state.placements.has(k) &&
        k.slice(4) === '82' &&
        ctx.geometry.slotExists(k) &&
        +k.slice(0, 2) === 86,
    )!;
}
