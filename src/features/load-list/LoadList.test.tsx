// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { resetStores } from '@/test/render';
import { LoadList } from './LoadList';

beforeEach(resetStores);

const footer = () => screen.getByTestId('load-list-footer');
const filters = () => within(screen.getByRole('group', { name: 'Filters' }));
const rowsShown = () => screen.getAllByRole('row').slice(1);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('LoadList', () => {
  it('draws only the visible rows of the 1,240 (FR-14)', () => {
    render(<LoadList />);
    const grid = screen.getByRole('grid', { name: 'Containers to load' });
    expect(grid).toHaveAttribute('aria-rowcount', '929'); // 928 unplanned and the header
    expect(rowsShown().length).toBeGreaterThan(10);
    expect(rowsShown().length).toBeLessThan(60);
    expect(screen.getByText('SGSIN · 1,240')).toBeInTheDocument();
  });

  it('shows the totals as designed: 3 ticked rows, 928 unplanned', () => {
    render(<LoadList />);
    expect(footer()).toHaveTextContent('3 selected · 69.6 t');
    expect(footer()).toHaveTextContent('928 shown · 928 unplanned');
  });

  it('searches', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    await user.type(screen.getByRole('textbox', { name: 'Search load list' }), 'NSPU 551208');
    expect(rowsShown()).toHaveLength(1);
    expect(within(rowsShown()[0]!).getByText('NSPU 551208 4')).toBeInTheDocument();
    expect(footer()).toHaveTextContent('1 shown');
  });

  it('shows an empty state and clears the search', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    await user.type(screen.getByRole('textbox', { name: 'Search load list' }), 'zzz');
    expect(screen.getByText('No containers match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(footer()).toHaveTextContent('928 shown');
    expect(screen.queryByText('No containers match')).not.toBeInTheDocument();
  });

  it('filters by POD and type from the chips', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    await user.click(filters().getByRole('button', { name: 'POD' }));
    await user.click(screen.getByRole('option', { name: 'RTM' }));
    const { loadList, state } = usePlanStore.getState();
    const unplanned = loadList.filter((c) => !state.slotOf.has(c.id));
    const rtm = unplanned.filter((c) => c.pod === 'NLRTM').length;
    expect(footer()).toHaveTextContent(`${rtm} shown`);
    expect(filters().getByRole('button', { name: 'POD: RTM' })).toBeInTheDocument();

    await user.click(filters().getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'RF' }));
    const both = unplanned.filter((c) => c.pod === 'NLRTM' && c.type === 'RF').length;
    expect(footer()).toHaveTextContent(`${both} shown`);

    await user.click(filters().getByRole('button', { name: 'POD: RTM' }));
    await user.click(screen.getByRole('option', { name: 'All PODs' }));
    expect(footer()).toHaveTextContent(`${unplanned.filter((c) => c.type === 'RF').length} shown`);
  });

  it('lets the keyboard choose from a chip list', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    filters().getByRole('button', { name: 'POD' }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(filters().getByRole('button', { name: 'POD: CMB' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('switches the Reefer, DG and Unplanned only chips', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    const { loadList, state } = usePlanStore.getState();
    const unplanned = loadList.filter((c) => !state.slotOf.has(c.id));

    await user.click(screen.getByRole('button', { name: 'Reefer' }));
    expect(screen.getByRole('button', { name: 'Reefer' })).toHaveAttribute('aria-pressed', 'true');
    expect(footer()).toHaveTextContent(`${unplanned.filter((c) => c.type === 'RF').length} shown`);
    await user.click(screen.getByRole('button', { name: 'Reefer' }));

    await user.click(screen.getByRole('button', { name: 'DG' }));
    expect(footer()).toHaveTextContent(`${unplanned.filter((c) => c.imdgClass).length} shown`);
    await user.click(screen.getByRole('button', { name: 'DG' }));

    await user.click(screen.getByRole('button', { name: 'Unplanned only' }));
    expect(footer()).toHaveTextContent('1,240 shown');
    expect(screen.getByRole('button', { name: 'Unplanned only' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('sorts by clicking a column, and flips the direction', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    const header = (name: string) =>
      screen.getByRole('columnheader', { name: new RegExp(`^${name}`) });
    expect(header('t')).toHaveAttribute('aria-sort', 'descending');

    await user.click(within(header('Container')).getByRole('button'));
    expect(header('Container')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('t')).toHaveAttribute('aria-sort', 'none');
    const ids = usePlanStore
      .getState()
      .loadList.filter((c) => !usePlanStore.getState().state.slotOf.has(c.id))
      .map((c) => c.id)
      .sort((a, b) => a.localeCompare(b));
    expect(within(rowsShown()[0]!).getByText(ids[0]!)).toBeInTheDocument();

    await user.click(within(header('Container')).getByRole('button'));
    expect(header('Container')).toHaveAttribute('aria-sort', 'descending');
    expect(within(rowsShown()[0]!).getByText(ids[ids.length - 1]!)).toBeInTheDocument();

    await user.click(within(header('Flags')).getByRole('button'));
    expect(header('Flags')).toHaveAttribute('aria-sort', 'descending');
  });

  it('ticks rows with the mouse and the footer follows (FR-15)', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    const first = rowsShown()[0]!;
    expect(first).toHaveAttribute('aria-selected', 'false');
    const weight = parseFloat(within(first).getAllByRole('gridcell')[3]!.textContent);
    await user.click(first);
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(footer()).toHaveTextContent(`4 selected · ${(69.6 + weight).toFixed(1)} t`);
    await user.click(within(first).getByRole('checkbox'));
    expect(first).toHaveAttribute('aria-selected', 'false');
    expect(footer()).toHaveTextContent('3 selected · 69.6 t');
  });

  it('moves with the arrow keys and ticks with Space', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    const grid = screen.getByRole('grid', { name: 'Containers to load' });
    grid.focus();
    expect(grid).toHaveAttribute('aria-activedescendant', 'll-row-0');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(grid).toHaveAttribute('aria-activedescendant', 'll-row-2');
    await user.keyboard(' ');
    expect(document.getElementById('ll-row-2')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{End}');
    expect(grid).toHaveAttribute('aria-activedescendant', 'll-row-927');
    await user.keyboard('{Home}');
    expect(grid).toHaveAttribute('aria-activedescendant', 'll-row-0');
    await user.keyboard('{PageDown}');
    expect(grid).toHaveAttribute('aria-activedescendant', 'll-row-10');
  });

  it('selects the container of a planned row in the bay view (FR-16)', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    await user.click(screen.getByRole('button', { name: 'Unplanned only' }));
    const { state } = usePlanStore.getState();
    const target = [...state.placements.values()].find(
      (p) =>
        p.origin === 'thisCall' &&
        p.slotKey.startsWith('30') === false &&
        p.slotKey.slice(0, 2) !== '18',
    )!;
    await user.type(screen.getByRole('textbox', { name: 'Search load list' }), target.containerId);
    await user.click(rowsShown()[0]!);
    const view = useViewStore.getState();
    expect(view.selected).toBe(target.slotKey);
    expect(view.bay).toBe(+target.slotKey.slice(0, 2));
    expect(within(rowsShown()[0]!).getByTitle('Planned slot')).toHaveTextContent(target.slotKey);
  });

  it('collapses to a rail with the unplanned count, and expands again (FR-07)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LoadList />);
    await user.click(screen.getByRole('button', { name: 'Collapse load list' }));
    rerender(<LoadList />);
    expect(screen.getByText(/928/)).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand load list' }));
    expect(screen.getByRole('grid', { name: 'Containers to load' })).toBeInTheDocument();
    await flush();
  });

  it('shows the reefer and dangerous goods flags with text for screen readers', () => {
    useViewStore.getState().setQuery({ type: 'RF', sortKey: 'flags', sortDir: -1 });
    const { unmount } = render(<LoadList />);
    expect(screen.getAllByRole('img', { name: 'Reefer' }).length).toBeGreaterThan(5);
    unmount();
    useViewStore.getState().setQuery({ type: null, dg: true });
    render(<LoadList />);
    expect(screen.getAllByRole('img', { name: /^Dangerous goods class / }).length).toBeGreaterThan(
      5,
    );
  });

  it('picks up the row with Enter and hands the keyboard to the bay grid (FR-17)', async () => {
    const user = userEvent.setup();
    render(<LoadList />);
    const grid = screen.getByRole('grid', { name: 'Containers to load' });
    grid.focus();
    const seq = useViewStore.getState().gridFocusSeq;
    await user.keyboard('{ArrowDown}{Enter}');
    const first = rowsShown()[1]!;
    const id = within(first).getAllByRole('gridcell')[1]!.textContent;
    const p = usePlacementStore.getState().placement;
    expect(p.kind !== 'idle' && p.kind !== 'swapping' && p.source.containerId).toBe(id);
    expect(useViewStore.getState().gridFocusSeq).toBe(seq + 1);
    // The row in hand is drawn dimmed with a dashed outline, as in screen 02.
    expect(first).toHaveAttribute('data-held', 'true');
  });
});
