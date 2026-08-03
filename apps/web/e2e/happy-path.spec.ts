import { expect, test } from '@playwright/test';

/**
 * The one happy path: a first-time visitor drafts, submits, watches the
 * fight, and replays it — with zero instructions.
 */
test('draft → submit → fight → replay', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Ladder Draft');
  await page.waitForSelector('.card');

  // Draft through all eight rounds, buying whatever is affordable.
  for (let round = 1; round <= 8; round++) {
    for (let i = 0; i < 3; i++) {
      const buy = page.locator('.mini-btn.buy:not([disabled])');
      if (await buy.count()) await buy.first().click();
    }
    const advance = page.locator('.shop-actions .btn.primary');
    const label = await advance.textContent();
    await advance.click();
    if (label?.includes('Seal')) break;
  }

  // Name it and seal it.
  await page.waitForSelector('button:has-text("Seal & Fight")');
  await page.click('button:has-text("Seal & Fight")');

  // The fight plays as kinetic type; skip to the verdict.
  await page.waitForURL('**/fight');
  await page.waitForSelector('.log-line');
  await page.click('button:has-text("Skip to the end")');
  await expect(page.locator('.verdict-row .outcome')).toBeVisible();
  await expect(page.locator('.kill-line')).toBeVisible();

  // Replay is deterministic — the same opening line appears again.
  const opening = await page.locator('.log-line').first().textContent();
  await page.click('button:has-text("Replay")');
  await page.waitForSelector('.log-line');
  expect(await page.locator('.log-line').first().textContent()).toBe(opening);
});
