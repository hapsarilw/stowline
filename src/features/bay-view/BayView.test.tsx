// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { dispatch, pickFromList, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { renderWorkspace, resetStores } from '@/test/render';
import { BayView } from './BayView';
import { buildBayModel, defaultFocus, nextFocus } from './model';

beforeEach(() => {
  resetStores();
  useViewStore.getState().setCenterTab('bay');
});

const cellByKey = (key: string) => document.getElementById(`bay-cell-${key}`)!;
const grid = () => screen.getByRole('grid', { name: /^Bay \d\d cross section/ });

describe('BayView (FR-26 to FR-29)', () => {
  it('draws the cross section with row, tier, hatch and stack totals', () => {
    render(<BayView />);
    expect(grid()).toHaveAccessibleName(
      'Bay 18 cross section, looking forward. Port on the left, starboard on the right.',
    );
    const columns = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(columns).toEqual([
      '16',
      '14',
      '12',
      '10',
      '08',
      '06',
      '04',
      '02',
      '01',
      '03',
      '05',
      '07',
      '09',
      '11',
      '13',
      '15',
    ]);
    const tiers = screen
      .getAllByRole('rowheader')
      .map((c) => c.textContent)
      .filter((t) => t !== 'Σ t');
    expect(tiers).toEqual([
      '92',
      '90',
      '88',
      '86',
      '84',
      '82',
      '16',
      '14',
      '12',
      '10',
      '08',
      '06',
      '04',
      '02',
    ]);
    expect(screen.getByText('HATCH')).toBeInTheDocument();
    expect(screen.getByText('Port'.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText('STBD')).toBeInTheDocument();
  });

  it('shows 18 forty-foot containers as in the design: ID digits, POD and weight', () => {
    render(<BayView />);
    const c = cellByKey('180486');
    expect(c).toHaveAccessibleName(/^180486, NSPU 482913 5, Rotterdam, 28\.4 tonnes/);
    expect(c).toHaveTextContent('2913');
    expect(c).toHaveTextContent('RTM 28.4');
    expect(c).toHaveAttribute('aria-selected', 'true');
    expect(c).toHaveAccessibleName(/error: Stack 18-04 deck: 96\.4 t of 90\.0 t limit/);
  });

  it('marks locked containers, plugs and violations in the label', () => {
    render(<BayView />);
    expect(cellByKey('180202')).toHaveAccessibleName(/locked/);
    expect(cellByKey('180202')).toHaveAttribute('data-state', expect.stringContaining('locked'));
    const plug = [...document.querySelectorAll('[data-state~="plug"]')][0]!;
    expect(plug).toHaveAccessibleName(/reefer plug/);
  });

  it('shows each stack total against its limit, red when over', () => {
    render(<BayView />);
    const over = screen.getByTitle('Stack 18-04 deck: 96.4 t of 90.0 t');
    expect(within(over).getByText('96.4')).toHaveClass('text-err');
    const ok = screen.getByTitle(/^Stack 18-02 deck: /);
    expect(ok).not.toHaveTextContent('96.4');
    expect(screen.getAllByText('/90').length + screen.getAllByText('/210').length).toBe(2);
  });

  it('uses the full cell in Bay and the compact cell in Split', () => {
    const { unmount } = render(<BayView />);
    expect(cellByKey('180486')).toHaveTextContent('RTM 28.4');
    expect(screen.getByRole('group', { name: 'Cell legend' })).toBeInTheDocument();
    unmount();
    act(() => useViewStore.getState().setCenterTab('split'));
    render(<BayView />);
    expect(cellByKey('180486')).toHaveTextContent('RTM');
    expect(cellByKey('180486')).not.toHaveTextContent('28.4');
    expect(cellByKey('180486')).not.toHaveTextContent('2913');
    expect(screen.queryByRole('group', { name: 'Cell legend' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full bay view/ })).toBeInTheDocument();
  });

  it('lists every cell state in the legend', () => {
    render(<BayView />);
    const legend = screen.getByRole('group', { name: 'Cell legend' });
    for (const t of [
      'Empty',
      'Occupied',
      'Selected',
      'Focus',
      'Valid',
      'Invalid',
      'Locked',
      'Violation',
    ]) {
      expect(within(legend).getByText(t)).toBeInTheDocument();
    }
  });
});

describe('BayView with keys and clicks', () => {
  it('selects the container that is clicked, and focuses its slot', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(cellByKey('180486'));
    expect(useViewStore.getState().selected).toBe('180486');
    await user.click(cellByKey('180286'));
    expect(useViewStore.getState().focus).toBe('180286');
  });

  it('moves between slots with the arrow keys and announces each one (FR-37)', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    grid().focus();
    expect(grid()).toHaveAttribute('aria-activedescendant', 'bay-cell-180486');
    await user.keyboard('{ArrowUp}');
    expect(useViewStore.getState().focus).toBe('180488');
    expect(useViewStore.getState().selected).toBe('180488');
    expect(screen.getByRole('status')).toHaveTextContent(
      /^180488, NSPU 771032 1, Colombo, 17\.1 tonnes/,
    );
    await user.keyboard('{ArrowRight}');
    expect(useViewStore.getState().focus).toBe('180288');
    expect(grid()).toHaveAttribute('aria-activedescendant', 'bay-cell-180288');
    await user.keyboard('{ArrowDown}{ArrowLeft}');
    expect(useViewStore.getState().focus).toBe('180486');
  });

  it('stops at the edge and skips slots that do not exist', async () => {
    const user = userEvent.setup();
    act(() => useViewStore.getState().setBay(2, '021086'));
    render(<BayView />);
    grid().focus();
    // Bay 02 has 10 deck rows, so rows 16 to 12 are missing on the left.
    await user.keyboard('{ArrowLeft}');
    expect(useViewStore.getState().focus).toBe('021086');
    await user.keyboard('{ArrowRight}');
    expect(useViewStore.getState().focus).toBe('020886');
  });

  it('draws a focus ring only while the grid has focus', () => {
    render(<BayView />);
    expect(cellByKey('180486')).not.toHaveAttribute(
      'data-state',
      expect.stringContaining('focused'),
    );
    act(() => grid().focus());
    expect(cellByKey('180486')).toHaveAttribute('data-state', expect.stringContaining('focused'));
  });
});

describe('20ft halves (D1)', () => {
  it('shows the two halves in a cell of the 40ft view', () => {
    act(() => useViewStore.getState().setBay(30, '300284'));
    render(<BayView />);
    const c = cellByKey('300284');
    expect(c).toHaveAccessibleName(/fore NSPU 318204 6, Rotterdam, 12\.6 tonnes; aft empty/);
    expect(c).toHaveAttribute('data-state', expect.stringContaining('violation-error'));
  });

  it('shows the fore halves in the fore view, with the same key as the plan', async () => {
    const user = userEvent.setup();
    act(() => useViewStore.getState().setBay(30, '300284'));
    render(<BayView />);
    await user.click(screen.getByRole('tab', { name: '20ft fore halves' }));
    expect(useViewStore.getState().half).toBe('fore');
    expect(useViewStore.getState().focus).toBe('290284');
    const c = cellByKey('290284');
    expect(c).toHaveAccessibleName(/^290284, NSPU 318204 6/);
    await user.click(c);
    expect(useViewStore.getState().selected).toBe('290284');
    await user.click(screen.getByRole('tab', { name: '20ft aft halves' }));
    expect(cellByKey('310284')).toHaveAccessibleName(/^310284, empty/);
  });

  it('shows a 40ft container in both half views, because it covers both', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(screen.getByRole('tab', { name: '20ft aft halves' }));
    expect(cellByKey('190486')).toHaveAccessibleName(/^190486, NSPU 482913 5/);
  });
});

describe('bay model', () => {
  const input = () => {
    const { ctx, state, violationIndex } = usePlanStore.getState();
    return { ctx, state, violations: violationIndex };
  };

  it('has 14 tiers of 16 cells, with cells that do not exist marked', () => {
    const m = buildBayModel({ ...input(), bay: 2, half: 'both', selected: null });
    expect(m.deck).toHaveLength(6);
    expect(m.hold).toHaveLength(5);
    const row = m.deck[0]!.cells;
    expect(row).toHaveLength(16);
    expect(row.filter((c) => c.exists)).toHaveLength(10);
  });

  it('applies marks for target slots, with the reason in the label', () => {
    const marks = new Map([
      ['180488', { mark: 'invalid' as const, reason: 'Stack limit: 96.4 t of 90.0 t' }],
    ]);
    const m = buildBayModel({ ...input(), bay: 18, half: 'both', selected: null, marks });
    const c = m.deck.flatMap((t) => t.cells).find((x) => x.key === '180488')!;
    expect(c.mark).toBe('invalid');
    expect(c.label).toContain('invalid target: Stack limit: 96.4 t of 90.0 t');
    const origin = buildBayModel({
      ...input(),
      bay: 18,
      half: 'both',
      selected: null,
      marks: new Map([['180488', { mark: 'origin' as const }]]),
    });
    expect(origin.deck.flatMap((t) => t.cells).find((x) => x.key === '180488')!.label).toContain(
      'picked up from here',
    );
    const warn = buildBayModel({
      ...input(),
      bay: 18,
      half: 'both',
      selected: null,
      marks: new Map([
        ['180488', { mark: 'warning' as const }],
        ['180486', { mark: 'valid' as const }],
      ]),
    });
    const labels = warn.deck.flatMap((t) => t.cells).filter((x) => x.mark);
    expect(labels.map((l) => l.label.split(', ').slice(-1)[0] ?? '')).toEqual(
      expect.arrayContaining(['valid target', 'valid target with warning']),
    );
  });

  it('gives the first slot of a bay and the next slot of an arrow key', () => {
    const { ctx, state } = usePlanStore.getState();
    expect(defaultFocus(ctx, state, 18, 'both')).toBe('180102');
    expect(defaultFocus(ctx, state, 18, 'fore')).toBe('171682');
    expect(nextFocus(ctx, 18, 'both', '180486', 1, 0)).toBe('180286');
    expect(nextFocus(ctx, 18, 'both', '180192', 0, -1)).toBeNull();
    expect(nextFocus(ctx, 99, 'both', '180486', 1, 0)).toBeNull();
    expect(() => defaultFocus(ctx, state, 99, 'both')).toThrow();
  });
});

describe('bay stepping (FR-30)', () => {
  it('steps through the bays from the toolbar and in the navigator (FR-10)', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const toolbar = screen.getByText('Bay 18', { selector: 'span[aria-live]' });
    await user.click(screen.getByRole('button', { name: 'Next bay' }));
    expect(toolbar).toHaveTextContent('Bay 22');
    expect(useViewStore.getState().bay).toBe(22);
    await user.click(screen.getByRole('button', { name: 'Previous bay' }));
    await user.click(screen.getByRole('button', { name: 'Previous bay' }));
    expect(toolbar).toHaveTextContent('Bay 14');
    await user.click(screen.getByRole('button', { name: /^Bay 42:/ }));
    expect(toolbar).toHaveTextContent('Bay 42');
    expect(screen.getByRole('button', { name: /^Bay 42:/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('disables Previous at the first bay and Next at the last', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /^Bay 02:/ }));
    expect(screen.getByRole('button', { name: 'Previous bay' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Bay 86:/ }));
    expect(screen.getByRole('button', { name: 'Next bay' })).toBeDisabled();
  });
});

describe('placing from the bay grid (FR-34, FR-35, FR-36, FR-37)', () => {
  const status = () => within(screen.getByRole('region', { name: 'Bay view' })).getByRole('status');

  it('picks up with Enter, marks the targets and the origin, and puts back with Esc', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(cellByKey('180488'));
    await user.keyboard('{Enter}');
    expect(status()).toHaveTextContent('Picked up');
    expect(status()).toHaveTextContent(
      'Picked up NSPU 771032 1 from 180488. 12 valid targets in bay 18.',
    );
    expect(cellByKey('180488').dataset.state).toContain('origin');
    expect(document.querySelectorAll('[data-state~="valid"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-state~="invalid"]').length).toBeGreaterThan(0);
    // The focus is on the first valid target, with the held container drawn there.
    expect(screen.getByTestId('held-ghost')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(status()).toHaveTextContent('Cancelled. Container returned to its slot.');
    expect(document.querySelectorAll('[data-state~="valid"]')).toHaveLength(0);
    expect(usePlacementStore.getState().placement.kind).toBe('idle');
  });

  it('moves the focus with the arrow keys while holding, without changing the selection', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(cellByKey('180488'));
    await user.keyboard('{Enter}');
    const focus = useViewStore.getState().focus;
    await user.keyboard('{ArrowLeft}');
    expect(useViewStore.getState().focus).not.toBe(focus);
    expect(useViewStore.getState().selected).toBe('180488');
    expect(status().textContent).toMatch(/\d{6}: /);
  });

  it('places on Enter and settles the container in its new slot', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(cellByKey('180488'));
    await user.keyboard('{Enter}');
    const to = useViewStore.getState().focus!;
    await user.keyboard('{Enter}');
    expect(status()).toHaveTextContent(`Moved NSPU 771032 1 to ${to}.`);
    expect(usePlanStore.getState().state.placements.get(to)?.containerId).toBe('NSPU 771032 1');
    expect(useViewStore.getState().selected).toBe(to);
    expect(usePlacementStore.getState().settle?.key).toBe(to);
  });

  it('keeps holding after a refused keyboard drop, and shakes the slot', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    act(() => pickFromList('NSPU 551208 4', 'keyboard'));
    act(() => useViewStore.getState().setFocus('180688'));
    grid().focus();
    await user.keyboard('{Enter}');
    expect(status()).toHaveTextContent(
      'Cannot place at 180688. Stack limit: 96.4 t of 90.0 t. Still holding NSPU 551208 4.',
    );
    expect(usePlacementStore.getState().shake?.key).toBe('180688');
    expect(usePlacementStore.getState().placement.kind).toBe('over');
  });

  it('shows the reason on the target under the pointer (FR-34)', () => {
    render(<BayView />);
    act(() => dispatch({ type: 'pickFromList', containerId: 'NSPU 551208 4', via: 'pointer' }));
    act(() => dispatch({ type: 'hover', key: '180688' }));
    const tip = within(cellByKey('180688')).getByRole('tooltip');
    expect(tip).toHaveTextContent('Stack limit: 96.4 t of 90.0 t');
    expect(tip).toHaveTextContent('Drop disabled at 180688');
  });

  it('places with a click while holding', async () => {
    const user = userEvent.setup();
    render(<BayView />);
    await user.click(cellByKey('180488'));
    await user.keyboard('{Enter}');
    await user.click(cellByKey('180688'));
    expect(usePlanStore.getState().state.placements.get('180688')?.containerId).toBe(
      'NSPU 771032 1',
    );
  });

  it('swaps with a click while swapping', async () => {
    const user = userEvent.setup();
    useViewStore.getState().setBay(46);
    render(<BayView />);
    act(() => dispatch({ type: 'startSwap', key: '460612' }));
    await user.click(cellByKey('460610'));
    expect(usePlanStore.getState().state.placements.get('460610')?.containerId).toBe(
      'NSPU 813350 9',
    );
  });
});
