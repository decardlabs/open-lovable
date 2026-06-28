import { test, expect } from '@playwright/test';

test.describe('Generation Page - Multi-Page Mode', () => {
  test('detects multi-page mode from sessionStorage', async ({ page }) => {
    // Set sessionStorage before navigation (mimics multi-page flow from landing page)
    await page.goto('/generation');
    await page.evaluate(() => {
      sessionStorage.setItem('multiPageMode', 'true');
      sessionStorage.setItem('multiPageCount', '3');
      sessionStorage.setItem('multiPageTitles', JSON.stringify(['首页', 'About', 'Products']));
    });

    // Reload to pick up sessionStorage
    await page.reload();
    await page.waitForTimeout(2000);

    // Multi-page status should be shown
    await expect(page.getByText(/3 pages|multi-page|Multi Page/i).first()).toBeVisible({ timeout: 10000 });
  });
});
