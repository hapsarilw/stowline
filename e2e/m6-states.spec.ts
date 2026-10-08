import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPlans, openWorkspace, settle, switchRole, wait3D } from './helpers';

// The states of design 09 to 16: axe in both themes, and screenshots to hold the look.

type Mock = {
  __stowMock: {
    control: {
      getState: () => {
        setFailNext: (s: number, n?: number, path?: string) => void;
        setExtraDelay: (ms: number) => void;
        setForce409: (b: boolean) => void;
      };
    };
  };
};
const mock = (page: Page, fn: string, ...args: number[]) =>
  page.evaluate(
    ([f, a]) => {
      const c = (window as unknown as Mock).__stowMock.control.getState() as unknown as Record<
        string,
        (...x: number[]) => void
      >;
      c[f]!(...a);
    },
    [fn, args] as const,
  );

const blocking = async (page: Page) =>
  (
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
  ).violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      nodes: v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
    }));

const shot = (page: Page, name: string, theme: string, mask: ReturnType<Page['locator']>[] = []) =>
  expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.002,
    mask,
  });

for (const theme of ['dark', 'light'] as const) {
  test.describe(theme, () => {
    // These walk through several requests with the mock's 150 to 400 ms delay each.
    test.describe.configure({ timeout: 60_000 });
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
    });

    test('09 account menu: keys, roles and the developer switch', async ({ page }) => {
      await openWorkspace(page, theme);
      const avatar = page.getByRole('button', { name: /^Account:/ });
      await avatar.focus();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu', { name: 'Account' });
      await expect(menu).toContainText('Rina Adiputri');
      await expect(menu).toContainText('Vessel planner · Singapore planning desk');
      await expect(page.getByRole('menuitemradio', { name: /^Vessel planner/ })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitemradio', { name: /^Senior planner/ })).toBeFocused();
      await expect(menu.getByText('Read only')).toHaveCount(2);
      expect(await blocking(page)).toEqual([]);
      await shot(page, 'account-menu-1440', theme, [page.getByTestId('viewport-canvas')]);
      await page.keyboard.press('Space');
      await expect(
        page.getByRole('button', { name: /^Account: Hendra Wirawan, senior planner/ }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Account:/ })).toBeFocused();
    });

    test('10 top bar: in review, blocked Approve with its reason on focus', async ({ page }) => {
      await openWorkspace(page, theme);
      await page.getByRole('button', { name: 'Send for review' }).click();
      await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
      // The toast goes after 5 s; take it away so the picture does not depend on timing.
      await page.getByRole('button', { name: 'Dismiss' }).click();
      await switchRole(page, 'Senior planner');
      const approve = page.getByRole('button', { name: 'Approve' });
      await approve.focus();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await settle(page);
      expect(await blocking(page)).toEqual([]);
      await shot(page, 'topbar-in-review-1440', theme, [page.getByTestId('viewport-canvas')]);
    });

    test('11 read only: approved plan and a read only role', async ({ page }) => {
      await openWorkspace(page, theme);
      await switchRole(page, 'Terminal planner');
      const strip = page.getByRole('note', { name: 'Read only' });
      await expect(strip).toContainText('Your role cannot change plans.');
      await expect(strip).toContainText('Terminal planner · Read only');
      await expect(page.getByRole('button', { name: 'Import load list' })).toBeDisabled();
      await page.getByRole('tab', { name: /^Violations/ }).click();
      await expect(page.getByRole('button', { name: /^Apply fix/ }).first()).toBeDisabled();
      await expect(page.getByRole('button', { name: /^Apply fix/ }).first()).toHaveAttribute(
        'title',
        'Your role cannot change plans.',
      );
      await page.getByRole('tab', { name: 'Inspector' }).click();
      await expect(page.getByRole('button', { name: /^Unplace/ })).toHaveCount(0);
      expect(await blocking(page)).toEqual([]);
      await shot(page, 'readonly-role-1440', theme, [page.getByTestId('viewport-canvas')]);
      await strip.getByRole('button', { name: 'Switch role' }).click();
      await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible();
    });

    test('12 save conflict: the alert, Save · 1 and the review dialog', async ({ page }) => {
      await openWorkspace(page, theme);
      await mock(page, 'setForce409', 1);
      await page.locator('#bay-cell-180488').click();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Save' }).click();
      const alert = page.getByRole('alert').filter({ hasText: 'saved version 15' });
      await expect(alert).toBeVisible();
      await settle(page);
      expect(await blocking(page)).toEqual([]);
      await shot(page, 'conflict-1440', theme, [
        page.getByTestId('viewport-canvas'),
        alert.locator('span').filter({ hasText: /at \d\d:\d\d/ }),
      ]);
      await alert.getByRole('button', { name: 'Review changes' }).click();
      const dialog = page.getByRole('dialog', { name: 'Review changes' });
      await expect(dialog).toContainText('Your kept changes');
      expect(await blocking(page)).toEqual([]);
      // Esc keeps the changes.
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
    });

    test('13 dialogs: return, new plan, import report', async ({ page }) => {
      await openPlans(page, theme);
      await page.getByRole('button', { name: 'New plan' }).click();
      const np = page.getByRole('dialog', { name: 'New plan' });
      await np.getByLabel('Voyage').fill('43W');
      await np.getByLabel(/^ETD/).fill('2026-10-05T22:00');
      await np.getByRole('button', { name: 'Create plan' }).click();
      await expect(np).toContainText('A voyage is 3 digits and a direction, like 043W.');
      await expect(np).toContainText("ETD can't be in the past.");
      await expect(np).toContainText('2 fields need fixing');
      await expect(np.getByText('Rina Adiputri')).toBeVisible();
      expect(await blocking(page)).toEqual([]);
      await expect(np).toHaveScreenshot(`dialog-new-plan-${theme}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
    });

    test('14 failure and loading pages', async ({ page }) => {
      await openPlans(page, theme);
      await mock(page, 'setExtraDelay', 1500);
      await page
        .getByRole('complementary', { name: 'Plan preview' })
        .getByRole('button', { name: 'Open plan' })
        .click();
      await expect(page.getByText('Vessel geometry, containers, load list')).toBeVisible();
      await expect(page.getByRole('status').getByText('042W-SGSIN')).toBeVisible();
      expect(await blocking(page)).toEqual([]);
      await shot(page, 'loading-1440', theme);
      await mock(page, 'setExtraDelay', 0);
      await page.getByRole('heading', { name: 'Load list' }).waitFor();
      await page.goBack();
      // The list and the preview load first, so the forced failures meet the plan route.
      await expect(
        page
          .getByRole('complementary', { name: 'Plan preview' })
          .getByText('Rina Adiputri validated the plan: 6 errors, 1 warning'),
      ).toBeVisible();
      await page.evaluate(() =>
        (window as unknown as Mock).__stowMock.control
          .getState()
          .setFailNext(503, 99, '/plans/042W-SGSIN'),
      );
      await page
        .getByRole('complementary', { name: 'Plan preview' })
        .getByRole('button', { name: 'Open plan' })
        .click();
      const failure = page.getByRole('alert').filter({ hasText: 'Request failed' });
      await expect(failure.getByRole('button', { name: 'Retry' })).toBeFocused();
      await expect(failure).toContainText(/GET \/plans\/042W-SGSIN · 503 · \d\d:\d\d:\d\d/);
      expect(await blocking(page)).toEqual([]);
      // The server answers again, then Retry opens the plan.
      await mock(page, 'setFailNext', 503, 0);
      await failure.getByRole('button', { name: 'Retry' }).click();
      await page.getByRole('heading', { name: 'Load list' }).waitFor();
    });

    test('15 plans states: empty, loading, cannot open, role notes', async ({ page }) => {
      await openPlans(page, theme);
      await page.getByRole('textbox', { name: 'Search plans' }).fill('zzz');
      const clear = page.getByRole('button', { name: 'Clear filters' });
      await expect(clear).toBeFocused();
      expect(await blocking(page)).toEqual([]);
      await clear.click();
      await page.getByRole('row', { name: /Riau Spirit/ }).click();
      const preview = page.getByRole('complementary', { name: 'Plan preview' });
      const open = preview.getByRole('button', { name: 'Open plan' });
      await expect(open).toHaveAttribute('aria-disabled', 'true');
      await expect(open).toHaveAccessibleDescription(
        'This voyage has no vessel geometry in the demo, so it cannot be opened.',
      );
      // Role notes on 042W, the plan that opens: planner in review, senior with errors, a read only role.
      await page.getByRole('row', { name: /Nusantara Pioneer/ }).click();
      await preview.getByRole('button', { name: 'Send for review' }).click();
      await expect(preview).toContainText('Opens read only until returned');
      await switchRole(page, 'Senior planner');
      await expect(preview.getByRole('button', { name: 'Return' })).toBeVisible();
      const approve = preview.getByRole('button', { name: 'Approve' });
      await expect(approve).toHaveAttribute('aria-disabled', 'true');
      await expect(approve).toHaveAccessibleDescription(
        '6 errors remain. Return the plan to fix them.',
      );
      await switchRole(page, 'Terminal planner');
      await expect(preview).toContainText('Opens read only');
      await page.getByRole('row', { name: /Arafura Dawn/ }).click();
      // An approved plan without geometry has nothing to export; a read only role cannot revise.
      await expect(preview.getByRole('button', { name: 'Revise' })).toHaveCount(0);
      expect(await blocking(page)).toEqual([]);
    });

    test('16 toasts: actions, and a hover keeps the toast', async ({ page }) => {
      // The page's clock, so the 5 s of the toast pass without waiting for them.
      await page.clock.install();
      await openWorkspace(page, theme);
      await wait3D(page);
      await page.getByRole('button', { name: 'Send for review' }).click();
      const toast = page
        .getByRole('status')
        .filter({ has: page.getByRole('button', { name: 'Dismiss' }) });
      await expect(toast).toContainText(
        'Version 14 is with the senior planners. It is read only until it is returned or approved.',
      );
      await toast.hover();
      await page.clock.fastForward(5600);
      await expect(toast).toBeVisible();
      await page.mouse.move(5, 5);
      await page.clock.fastForward(4900);
      await expect(toast).toBeVisible();
      await page.clock.fastForward(200);
      await expect(toast).toHaveCount(0);
      expect(await blocking(page)).toEqual([]);
    });
  });
}
