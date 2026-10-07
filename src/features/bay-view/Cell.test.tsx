// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Cell } from './Cell';
import type { CellBox, CellModel } from './model';

// FR-27: every cell state in the components sheet.

const box = (over: Partial<CellBox> = {}): CellBox => ({
  id: 'NSPU 482913 5',
  last4: '2913',
  pod: 'RTM',
  podName: 'Rotterdam',
  weightT: 28.4,
  weight: '28.4',
  reefer: false,
  dgClass: null,
  locked: false,
  slot: '180486',
  lengthFt: 40,
  ...over,
});

const model = (over: Partial<CellModel> = {}): CellModel => ({
  key: '180486',
  exists: true,
  plug: false,
  box: null,
  halves: null,
  violation: null,
  selected: false,
  mark: null,
  label: '180486, empty',
  ...over,
});

const cell = () => screen.getByRole('gridcell');
const show = (m: Partial<CellModel>, props: { big?: boolean; focused?: boolean } = {}) =>
  render(<Cell cell={model(m)} big={props.big ?? true} focused={props.focused ?? false} />);

describe('Cell states', () => {
  it('empty', () => {
    show({});
    expect(cell()).toHaveAttribute('data-state', 'empty');
    expect(cell().style.border).toContain('var(--border)');
    expect(cell().textContent).toBe('');
  });

  it('empty with a reefer plug shows the plug icon', () => {
    const { container } = show({ plug: true });
    expect(cell()).toHaveAttribute('data-state', 'empty plug');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('occupied: POD color, last 4 digits, POD code and weight', () => {
    show({ box: box() });
    expect(cell()).toHaveAttribute('data-state', 'occupied');
    expect(cell().style.backgroundColor).toBe('var(--pod-nlrtm)');
    expect(cell()).toHaveTextContent('2913');
    expect(cell()).toHaveTextContent('RTM 28.4');
  });

  it('occupied, compact: only the POD code, which still names the port (NFR-12)', () => {
    show({ box: box() }, { big: false });
    expect(cell()).toHaveTextContent(/^RTM$/);
  });

  it('selected has a ring in the text color', () => {
    show({ box: box(), selected: true });
    expect(cell()).toHaveAttribute('aria-selected', 'true');
    expect(cell().style.boxShadow).toContain('0 0 0 2px var(--text)');
  });

  it('focused has an accent outline', () => {
    show({}, { focused: true });
    expect(cell().style.outline).toBe('2px solid var(--accent)');
    expect(cell()).toHaveAttribute('data-state', expect.stringContaining('focused'));
  });

  it('valid target', () => {
    show({ mark: 'valid', label: '180486, empty, valid target' });
    expect(cell().style.backgroundColor).toBe('var(--okbg)');
    expect(cell().style.border).toContain('var(--ok)');
    expect(cell()).toHaveAccessibleName(/valid target/);
  });

  it('valid with warning', () => {
    show({ mark: 'warning' });
    expect(cell().style.backgroundColor).toBe('var(--warnbg)');
    expect(cell().style.border).toContain('var(--warn)');
  });

  it('invalid target is hatched, not just red', () => {
    show({ mark: 'invalid' });
    expect(cell().style.border).toContain('var(--err)');
    expect(cell().style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('locked is hatched and shows a lock', () => {
    const { container } = show({ box: box({ locked: true }) });
    expect(cell()).toHaveAttribute('data-state', expect.stringContaining('locked'));
    expect(cell().style.backgroundImage).toContain('repeating-linear-gradient');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('has violation: an inset ring and a "!" marker', () => {
    show({ box: box(), violation: 'error' });
    expect(cell().style.boxShadow).toContain('inset 0 0 0 2px #b3141b');
    expect(cell()).toHaveTextContent('!');
    show({ box: box(), violation: 'warning' });
    expect(screen.getAllByRole('gridcell')[1]!.style.boxShadow).toContain('#8a5a00');
  });

  it('picked-up origin has a dashed outline and hides the container', () => {
    show({ box: box(), mark: 'origin' });
    expect(cell().style.border).toBe('1px dashed var(--accent)');
    expect(cell()).not.toHaveTextContent('2913');
  });

  it('shows reefer, DG class and the stack of two 20ft containers', () => {
    show({ box: box({ reefer: true, dgClass: '3' }) });
    expect(cell()).toHaveTextContent('3');
    const { unmount } = show({ halves: [box({ pod: 'JEA' }), null] });
    expect(screen.getAllByRole('gridcell')[1]).toHaveTextContent('JEA');
    unmount();
  });

  it('renders nothing visible for a slot that does not exist', () => {
    const { container } = show({ exists: false });
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows a tooltip with the rule result and reports clicks', async () => {
    const onSelect = vi.fn();
    render(
      <Cell
        cell={model({ mark: 'invalid' })}
        big
        focused={false}
        tip={{
          tone: 'error',
          title: 'Stack limit: 96.4 t of 90.0 t',
          detail: 'Drop disabled at 180688',
        }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Stack limit: 96.4 t of 90.0 t');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Drop disabled at 180688');
    await userEvent.click(cell());
    expect(onSelect).toHaveBeenCalledWith('180486');
  });
});
