import { test, expect } from '@playwright/test';

async function seedRandom(page){
  await page.addInitScript(()=>{
    let seed=246813579;
    Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  });
}

test('mode selector exposes solo, online and local play', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mode-card')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'Play Solo vs AI'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Online Multiplayer'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Play Local Mode'})).toBeVisible();
});

test('solo mode starts, supports discussion and reaches final standings through four rounds', async ({ page }) => {
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await seedRandom(page);
  await page.goto('/solo.html');

  await page.locator('#soloName').fill('Solo Tester');
  await page.locator('#soloSetupForm button[type="submit"]').click();
  await expect(page.locator('#soloGame')).toBeVisible();
  await expect(page.locator('#roundText')).toHaveText('1 / 4');
  await expect(page.locator('#soloPlayerGrid .player-card')).toHaveCount(10);

  await page.locator('#revealSoloRoleBtn').click();
  await expect(page.locator('#soloRoleDialog')).toBeVisible();
  await expect(page.locator('#soloRoleName')).not.toHaveText('');
  await page.locator('[data-close="soloRoleDialog"]').last().click();

  await page.locator('#discussionInput').fill('Anyone want a round-one truce?');
  await page.locator('#discussionForm button[type="submit"]').click();
  await expect(page.locator('#discussionLog')).toContainText('Anyone want a round-one truce?');

  for(let round=1;round<=4;round++){
    await expect(page.locator('#roundText')).toHaveText(`${round} / 4`);
    await expect(page.locator('#phaseText')).toContainText('Discussion');
    await page.locator('#beginPredationBtn').click();

    const stages=round<=2?1:2;
    for(let stage=0;stage<stages;stage++){
      await expect(page.locator('#phaseText')).toContainText('Predation');
      const pass=page.locator('#soloPassBtn');
      if(await pass.count())await pass.click();
      await page.locator('#endSoloStageBtn').click();
    }

    await expect(page.locator('#phaseText')).toHaveText('Evolution Auction');
    const auto=page.locator('#autoAuctionBtn');
    if(await auto.count())await auto.click();
    await expect(page.locator('#nextRoundBtn')).toBeVisible();
    await page.locator('#nextRoundBtn').click();
  }

  await expect(page.locator('#phaseText')).toHaveText('Final Standings');
  await expect(page.locator('#soloControlTitle')).toHaveText('Final Standings');
  await expect(page.locator('.standings-grid .tool-card')).toHaveCount(10);
  expect(pageErrors).toEqual([]);
});
