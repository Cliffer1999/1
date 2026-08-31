import { test, expect } from '@playwright/test';

test('a 10-player game can start, reveal a role, resolve predation and reach evolution', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Wild Australia: Evolution Clash/);
  await expect(page.locator('#setupView')).toBeVisible();

  await page.locator('#setupForm button[type="submit"]').click();
  await expect(page.locator('#gameView')).toBeVisible();
  await expect(page.locator('#roundText')).toHaveText('1 / 4');
  await expect(page.locator('.player-card')).toHaveCount(10);

  await page.locator('[data-role="1"]').click();
  await expect(page.locator('#roleDialog')).toBeVisible();
  await page.locator('#revealRoleBtn').click();
  await expect(page.locator('#roleName')).not.toHaveText('');
  await page.locator('[data-close="roleDialog"]').last().click();
  await expect(page.locator('#roleDialog')).not.toBeVisible();

  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toContainText('Predation');
  await expect(page.locator('#predationBtn')).toBeVisible();

  await page.locator('#predator').selectOption('1');
  await page.locator('#prey').selectOption('5');
  await page.locator('#predationBtn').click();
  await expect(page.locator('#messageDialog')).toBeVisible();
  await expect(page.locator('#messageKicker')).toHaveText('PREDATION RESULT');
  await page.locator('[data-close="messageDialog"]').last().click();

  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await expect(page.locator('.skill-card')).toHaveCount(3);

  expect(pageErrors).toEqual([]);
});

test('rules modal exposes the complete 17-skill Australian deck', async ({ page }) => {
  await page.goto('/');
  await page.locator('#rulesBtn').click();
  await expect(page.locator('#rulesDialog')).toBeVisible();
  await expect(page.locator('.skill-rule')).toHaveCount(17);
  await expect(page.locator('#rulesContent')).toContainText('Outback');
  await expect(page.locator('#rulesContent')).toContainText('Great Barrier Reef');
  await expect(page.locator('#rulesContent')).toContainText('Bushland');
});
