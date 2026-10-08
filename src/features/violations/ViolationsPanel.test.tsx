// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { stackWeightTenths, suggestFix, validateAll } from '@/domain';
import { fixFor } from '@/state/actions';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { resetStores } from '@/test/render';
import { buildViolations, clock } from './model';
import { ViolationsPanel } from './ViolationsPanel';

beforeEach(resetStores);

const plan = () => usePlanStore.getState();
const view = () => useViewStore.getState();
const rows = () => screen.getAllByRole('article');
const row = (name: RegExp) => screen.getByRole('article', { name });

describe('violations model (FR-42, FR-44)', () => {
  const input = () => ({
    violations: plan().violations,
    state: plan().state,
    ctx: plan().ctx,
    severity: 'all' as const,
    focused: 'stack:18-4-D',
    newIds: new Set<string>(),
    checkedAt: new Date(2026, 9, 7, 14, 32, 8),
    fixOf: fixFor,
  });

  it('counts and words as design 04', () => {
    const m = buildViolations(input());
    expect(m.filters).toEqual([
      { id: 'all', label: 'All', count: 7 },
      { id: 'error', label: 'Errors', count: 6 },
      { id: 'warning', label: 'Warnings', count: 1 },
    ]);
    expect(m.summary).toBe('6 errors block approval · checked 14:32:08 · re-checks on every move');
    expect(m.groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['Errors', 6],
      ['Warnings', 1],
    ]);
    const stack = m.groups[0]!.rows[0]!;
    expect(stack).toMatchObject({
      heading: 'Error · Stack weight',
      message: 'Stack 18-04 deck: 96.4 t of 90.0 t limit',
      slot: '180488',
      selected: true,
      fixText: 'Move NSPU 771032 1 (17.1 t) to 180688',
      action: { label: 'Apply fix' },
    });
    expect(stack.involved.map((x) => [x.slot, x.id, x.weight, x.pod])).toEqual([
      ['180482', 'NSPU 730118 2', '26.8', 'HAM'],
      ['180484', 'NSPU 615540 9', '24.1', 'RTM'],
      ['180486', 'NSPU 482913 5', '28.4', 'RTM'],
      ['180488', 'NSPU 771032 1', '17.1', 'CMB'],
    ]);
  });

  it('says why there is no fix, and offers Unplace (SRS "Fix suggestions")', () => {
    const reefer = buildViolations(input()).groups[0]!.rows.find((r) => r.id === 'reefer:220610')!;
    expect(reefer.fixText).toBe('No free slot with a reefer plug on board');
    expect(reefer.action).toEqual({ label: 'Unplace', name: 'Unplace NSPU 220417 3' });
  });

  it('filters by severity, and words one error and none', () => {
    expect(buildViolations({ ...input(), severity: 'warning' }).groups.map((g) => g.label)).toEqual(
      ['Warnings'],
    );
    expect(buildViolations({ ...input(), severity: 'error' }).groups.map((g) => g.label)).toEqual([
      'Errors',
    ]);
    const one = plan().violations.filter((v) => v.id === 'stack:18-4-D');
    expect(buildViolations({ ...input(), violations: one }).summary).toMatch(
      /^1 error blocks approval/,
    );
    const none = buildViolations({ ...input(), violations: [] });
    expect(none.empty).toBe(true);
    expect(none.summary).toMatch(/^No errors block approval/);
    expect(clock(new Date(2026, 0, 2, 3, 4, 5))).toBe('03:04:05');
  });

  it('uses the domain fix, once per plan state', () => {
    const v = plan().violations[0]!;
    expect(fixFor(v)).toEqual(suggestFix(v, plan().state, plan().ctx));
    expect(fixFor(v)).toBe(fixFor(v));
  });
});

describe('ViolationsPanel', () => {
  it('groups errors and warnings, with the severity filter as radios', async () => {
    const user = userEvent.setup();
    render(<ViolationsPanel />);
    expect(screen.getByRole('group', { name: 'Errors' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Warnings' })).toBeInTheDocument();
    expect(rows()).toHaveLength(7);
    const severity = screen.getByRole('radiogroup', { name: 'Severity' });
    expect(within(severity).getByRole('radio', { name: 'All 7' })).toBeChecked();
    await user.click(within(severity).getByRole('radio', { name: 'Warnings 1' }));
    expect(rows()).toHaveLength(1);
    // Arrow keys move the choice, as in any radio group.
    await user.keyboard('{ArrowLeft}');
    expect(within(severity).getByRole('radio', { name: 'Errors 6' })).toBeChecked();
    expect(rows()).toHaveLength(6);
  });

  it('Show focuses the violation: selection, bay, dimming, camera and the involved list (FR-43)', async () => {
    const user = userEvent.setup();
    view().setCenterTab('bay');
    render(<ViolationsPanel />);
    const dg = row(/IMDG 3 next to IMDG 5.1/);
    await user.click(within(dg).getByRole('button', { name: /^Show/ }));
    expect(view()).toMatchObject({
      focusedViolation: 'dg:140284-140484',
      bay: 14,
      selected: '140284',
      highlight: ['140284', '140484'],
      centerTab: 'split',
      camera: { bay: 14 },
    });
    expect(within(dg).getByRole('list', { name: 'Containers involved' })).toBeInTheDocument();
    act(() => view().clearViolationFocus());
    expect(view()).toMatchObject({
      focusedViolation: null,
      highlight: null,
      camera: { bay: null },
    });
  });

  it('AT-04: Apply fix resolves the stack weight, 18-04 reads 79.3 t, and Undo brings it back (FR-44, FR-45)', async () => {
    const user = userEvent.setup();
    render(<ViolationsPanel />);
    await user.click(within(row(/Stack 18-04 deck/)).getByRole('button', { name: /^Apply fix/ }));
    expect(plan().violations).toHaveLength(6);
    expect(stackWeightTenths(plan().state, plan().ctx, '18-4-D')).toBe(793);
    expect(view().toast).toMatchObject({ title: 'Resolved · Stack weight', undo: true });
    expect(rows()).toHaveLength(6);
    act(() => void plan().undo());
    expect(plan().violations).toEqual(validateAll(plan().state, plan().ctx));
    expect(rows()).toHaveLength(7);
    // The violation that came back slides in.
    expect(row(/Stack 18-04 deck/).className).toContain('stw-slide');
  });

  it('runs the alternative when there is no fix', async () => {
    const user = userEvent.setup();
    render(<ViolationsPanel />);
    await user.click(screen.getByRole('button', { name: 'Unplace NSPU 220417 3' }));
    expect(plan().state.placements.has('220610')).toBe(false);
    expect(rows()).toHaveLength(6);
  });

  it('says so when there is nothing to fix', () => {
    act(() => plan().setViolations([]));
    render(<ViolationsPanel />);
    expect(screen.getByText('No violations')).toBeInTheDocument();
    expect(screen.getByText('All rule checks pass for the current plan.')).toBeInTheDocument();
  });
});
