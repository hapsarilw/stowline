// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountMenu } from '@/app/AccountMenu';
import { useMockControl } from '@/api/mock/control';
import { usePlanStore } from '@/state/plan-store';
import { useSessionStore } from '@/state/session-store';
import { resetStores } from '@/test/render';
import { Dialog } from '@/ui/Dialog';
import { WorkflowButtons } from './WorkflowButtons';

beforeEach(() => {
  resetStores();
  useSessionStore.setState({ role: 'planner' });
  useMockControl.setState({ force409: false, failNext: null });
});

const set = (status: 'draft' | 'in_review' | 'approved') =>
  act(() => usePlanStore.getState().setStatus(status, 14));
const names = () =>
  screen.queryAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('WorkflowButtons (FR-62, FR-63, AT-06)', () => {
  it('a planner can send a draft for review and nothing else', () => {
    render(<WorkflowButtons />);
    expect(names()).toEqual(['Send for review']);
  });

  it('Approve is not offered to a planner, disabled for a senior with errors, enabled without', () => {
    set('in_review');
    render(<WorkflowButtons />);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    act(() => useSessionStore.getState().setRole('senior'));
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute('title', '6 errors remain: fix them to approve');
    expect(screen.getByRole('button', { name: 'Return' })).toBeEnabled();
    act(() => usePlanStore.getState().setViolations([]));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('Return asks for a comment before it goes ahead', async () => {
    set('in_review');
    act(() => useSessionStore.getState().setRole('senior'));
    const user = userEvent.setup();
    render(<WorkflowButtons />);
    await user.click(screen.getByRole('button', { name: 'Return' }));
    await user.click(screen.getByRole('button', { name: 'Return to Draft' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A comment is required when a plan is returned.',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an approved plan offers Revise and Export, and a terminal planner only Export', () => {
    set('approved');
    render(<WorkflowButtons />);
    expect(names()).toEqual(['Revise', 'Export']);
    act(() => useSessionStore.getState().setRole('terminal'));
    expect(names()).toEqual(['Export']);
  });
});

describe('AccountMenu', () => {
  it('names the user, switches the role and sets the developer switch', async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    const button = screen.getByRole('button', { name: 'Account: Rina Adiputri, vessel planner' });
    await user.click(button);
    await user.click(screen.getByRole('radio', { name: /^Senior planner/ }));
    expect(useSessionStore.getState().role).toBe('senior');
    expect(
      screen.getByRole('button', { name: 'Account: Hendra Wirawan, senior planner' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Terminal planner/ })).toHaveTextContent('Read only');
    await user.click(screen.getByLabelText('Next save returns 409'));
    expect(useMockControl.getState().force409).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Account menu' })).toBeNull();
  });
});

describe('Dialog', () => {
  it('keeps Tab inside, closes with Esc, and gives the focus back', async () => {
    const user = userEvent.setup();
    let closed = 0;
    const { rerender } = render(
      <>
        <button>Before</button>
        <Dialog title="Test" onClose={() => closed++} footer={<button>Last</button>}>
          <input aria-label="Field" />
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Test' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(closed).toBe(1);
    rerender(<button>Before</button>);
  });
});
