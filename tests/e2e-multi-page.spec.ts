import { test, expect } from '@playwright/test';

test.describe('Multi-Page Clone E2E', () => {
  test('complete multi-page flow from landing page', async ({ page }) => {
    // Mock website-map API
    await page.route('**/api/website-map', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          url: 'https://example.com',
          pages: [
            { path: '/', title: '首页', depth: 0 },
            { path: '/about', title: 'About', depth: 1 },
            { path: '/products', title: 'Products', depth: 1 },
          ],
        }),
      });
    });

    // Mock sandbox creation
    await page.route('**/api/create-ai-sandbox-v2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sandboxId: 'e2e-test-sandbox',
          url: 'http://localhost:5173',
          provider: 'local',
          message: 'Sandbox created',
        }),
      });
    });

    // Mock conversation state
    await page.route('**/api/conversation-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/');

    // Step 1: Enter URL and switch to multi-page mode
    const input = page.locator('input[placeholder*="Enter URL"]');
    await input.fill('https://example.com');

    // Step 2: Click multi-page toggle
    await page.locator('text=Multi Page').first().click();

    // Step 3: Click Discover Pages
    const discoverBtn = page.locator('button:has-text("Discover Pages")');
    await expect(discoverBtn).toBeVisible({ timeout: 3000 });
    await discoverBtn.click();

    // Step 4: Verify pages appear
    await page.waitForTimeout(2000);
    await expect(page.locator('text=首页').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=About').first()).toBeVisible();

    // Step 5: Click clone button
    const cloneBtn = page.locator('button:has-text("克隆所选")');
    await expect(cloneBtn).toBeVisible();
    await cloneBtn.click();

    // Step 6: Should navigate to /generation
    await page.waitForURL(/\/generation/, { timeout: 15000 });
    expect(page.url()).toContain('/generation');

    // Step 7: Should show multi-page status
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Multi Page|multi-page|3 pages/).first()).toBeVisible({ timeout: 10000 });
  });
});
