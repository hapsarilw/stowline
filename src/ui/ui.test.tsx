// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CountBadge, PodBadge, PodSwatch, StatusBadge, StatusIcon } from './Badges';
import { Button, IconButton } from './Button';
import { Tabs } from './Tabs';
import { Toast } from './Toast';
import { TooltipCard } from './TooltipCard';

// The shared pieces from the components sheet.

describe('Button', () => {
  it('has the four variants and a disabled state', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" onClick={onClick}>
          Save
        </Button>
        <Button>Validate</Button>
        <Button variant="ghost">Re-run</Button>
        <Button variant="danger">Unplace</Button>
        <Button disabled onClick={onClick}>
          Off
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('bg-accent');
    expect(screen.getByRole('button', { name: 'Unplace' })).toHaveClass('text-err');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('gives an icon button its name and a 24 or 28 px size', () => {
    render(
      <>
        <IconButton label="Undo">x</IconButton>
        <IconButton label="Small" size="sm">
          x
        </IconButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass('size-7');
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('size-6');
  });
});

describe('Badges', () => {
  it('prints the POD code with its color (NFR-12)', () => {
    render(<PodBadge pod="NLRTM" />);
    const b = screen.getByText('RTM');
    expect(b).toHaveStyle({ background: 'var(--pod-nlrtm)' });
    expect(b).toHaveAttribute('title', 'Rotterdam');
  });

  it('shows plan status as text with a dot', () => {
    render(
      <>
        <StatusBadge status="draft" />
        <StatusBadge status="in_review" />
        <StatusBadge status="approved" />
      </>,
    );
    for (const t of ['Draft', 'In review', 'Approved'])
      expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('gives every status an icon and text', () => {
    render(
      <>
        <StatusIcon tone="error" />
        <StatusIcon tone="warning" />
        <StatusIcon tone="ok" />
        <StatusIcon tone="na" />
        <PodSwatch pod="LKCMB" />
        <CountBadge tone="err" label="violations">
          7
        </CountBadge>
      </>,
    );
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('aria-label'))).toEqual([
      'Error',
      'Warning',
      'Pass',
      'Not applicable',
    ]);
    expect(screen.getByText('7').parentElement).toHaveTextContent('7 violations');
  });
});

describe('Tabs', () => {
  it('has one tab stop and moves with the arrow keys', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Test"
        value="b"
        onChange={onChange}
        tabs={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('tabindex', '0');
    screen.getByRole('tab', { name: 'B' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('c');
  });
});

describe('Toast', () => {
  it('announces errors at once and the rest politely, each with an icon and a title (NFR-14)', () => {
    render(
      <>
        <Toast
          tone="err"
          title="Can't place NSPU 551208 4 at 180688"
          message="Stack limit: 96.4 t of 90.0 t."
        />
        <Toast tone="warn" title="New violation · Heavy over light" />
        <Toast
          tone="ok"
          title="Resolved · Stack weight"
          onUndo={() => undefined}
          onDismiss={() => undefined}
        />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Can't place NSPU 551208 4 at 180688");
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});

describe('TooltipCard', () => {
  it('shows the rule result with an icon and text', () => {
    render(
      <>
        <TooltipCard
          tone="error"
          title="Stack limit: 96.4 t of 90.0 t"
          detail="Drop disabled at 180688"
        />
        <TooltipCard title="NSPU 482913 5" detail="180486 · 40HC · 28.4 t" />
      </>,
    );
    const [err, plain] = screen.getAllByRole('tooltip');
    expect(err!.querySelector('svg')).not.toBeNull();
    expect(err).toHaveClass('border-err');
    expect(plain!.querySelector('svg')).toBeNull();
  });
});
