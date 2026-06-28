import { test, expect } from '@playwright/test';

test.describe('Page Selector UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows multi-page toggle for valid URL', async ({ page }) => {
    const input = page.locator('input[placeholder*="Enter URL"]');
    await input.fill('https://example.com');

    // Should see the multi-page toggle
    await expect(page.locator('text=Multi Page').first()).toBeVisible({ timeout: 3000 });
  });

  test('multi-page mode toggles page selector', async ({ page }) => {
    const input = page.locator('input[placeholder*="Enter URL"]');
    await input.fill('https://example.com');

    // Click multi-page toggle
    await page.locator('text=Multi Page').first().click();

    // Map button should appear
    await expect(page.locator('button:has-text("Discover Pages")').first()).toBeVisible({ timeout: 3000 });
  });

  test('discovered pages show as checkable list', async ({ page }) => {
    // Mock the website-map API
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
            { path: '/contact', title: 'Contact', depth: 1 },
          ],
        }),
      });
    });

    const input = page.locator('input[placeholder*="Enter URL"]');
    await input.fill('https://example.com');

    // Switch to multi-page and click discover
    await page.locator('text=Multi Page').first().click();
    await page.locator('button:has-text("Discover Pages")').first().click();

    // Wait for pages to appear
    await page.waitForTimeout(2000);

    // Checkboxes should be rendered
    await expect(page.locator('text=首页').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=About').first()).toBeVisible();
    await expect(page.locator('text=Products').first()).toBeVisible();
  });

  test('shows image source toggle when pages are loaded', async ({ page }) => {
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
          ],
        }),
      });
    });

    const input = page.locator('input[placeholder*="Enter URL"]');
    await input.fill('https://example.com');
    await page.locator('text=Multi Page').first().click();
    await page.locator('button:has-text("Discover Pages")').first().click();
    await page.waitForTimeout(2000);

    // Image source toggle should be visible
    await expect(page.locator('text=图片来源').first()).toBeVisible({ timeout: 5000 });
    // Both options should be visible
    await expect(page.locator('text=Use original URLs').first()).toBeVisible();
    await expect(page.locator('text=Download to local').first()).toBeVisible();
  });
});
