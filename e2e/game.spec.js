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

test('a player who still passes and was not targeted pays the stage value', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#setupForm button[type="submit"]').click();
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toContainText('Predation');

  await page.locator('#passPlayer').selectOption('1');
  await page.locator('#passBtn').click();
  await expect(page.locator('.player-card').first().locator('.status-row')).toContainText('PASS PENDING');

  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await expect(page.locator('.player-card').first().locator('.life')).toContainText('18');
  await expect(page.locator('#eventLog')).toContainText('still refused predation');

  expect(pageErrors).toEqual([]);
});

test('the browser state machine can complete all four rounds and show final standings', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#setupForm button[type="submit"]').click();

  // Round 1: Free -> Predation -> Evolution -> Round 2.
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toContainText('Predation');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#roundText')).toHaveText('2 / 4');
  await expect(page.locator('#phaseText')).toHaveText('Free');

  // Round 2: Free -> Predation -> Evolution -> Round 3.
  await page.locator('#advanceBtn').click();
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#roundText')).toHaveText('3 / 4');

  // Round 3 has two predation stages.
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Predation 1/2');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Predation 2/2');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#roundText')).toHaveText('4 / 4');

  // Round 4 also has two predation stages, then the game finishes.
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Predation 1/2');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Predation 2/2');
  await page.locator('#advanceBtn').click();
  await expect(page.locator('#phaseText')).toHaveText('Evolution');
  await page.locator('#advanceBtn').click();

  await expect(page.locator('#phaseText')).toHaveText('Finished');
  await expect(page.locator('#controlTitle')).toHaveText('Final Standings');
  await expect(page.locator('#phaseControls .tool-card')).toHaveCount(10);
  expect(pageErrors).toEqual([]);
});

test('rules modal exposes the complete 17-skill Australian deck', async ({ page }) => {
  await page.goto('/');
  await page.locator('#rulesBtn').click();
  await expect(page.locator('#rulesDialog')).toBeVisible();
  await expect(page.locator('.skill-rule')).toHaveCount(17);
  await expect(page.locator('#rulesContent')).toContainText('Outback');
  await expect(page.locator('#rulesContent')).toContainText('Reef');
  await expect(page.locator('#rulesContent')).toContainText('Bushland');
  await expect(page.locator('#rulesContent')).toContainText('Pass rule');
});
