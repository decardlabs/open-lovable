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

  test('downloads images from scraped pages', async ({ page }) => {
    // Set sessionStorage BEFORE navigation so the React component can read it on mount
    await page.addInitScript(() => {
      sessionStorage.setItem('multiPageMode', 'true');
      sessionStorage.setItem('multiPageSelected', JSON.stringify([
        { path: '/', title: 'Home' },
      ]));
      sessionStorage.setItem('multiPageCount', '1');
      sessionStorage.setItem('targetUrl', 'https://example.com');
    });

    let downloadCommands: string[] = [];
    await page.route('**/api/run-command-v2', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.command && body.command.includes('curl')) {
        downloadCommands.push(body.command);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Intercept batch-scrape to return pages with images
    await page.route('**/api/batch-scrape', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const response = new Response(
        `data: {"type":"page-start","url":"https://example.com","index":0,"total":1}\n\n` +
        `data: {"type":"page-done","url":"https://example.com","title":"Home","content":"![logo](https://example.com/logo.png) <img src='https://example.com/banner.jpg' />","screenshot":null,"images":["https://example.com/logo.png","https://example.com/banner.jpg"]}\n\n` +
        `data: {"type":"complete","totalPages":1,"successfulPages":1}\n\n`,
        {
          headers: { 'Content-Type': 'text/event-stream' },
        }
      );
      await route.fulfill({ status: 200, body: await response.text(), contentType: 'text/event-stream' });
    });

    // Intercept generate-multi-page and return success
    let sentPages: any[] = [];
    await page.route('**/api/generate-multi-page', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      sentPages = body.pages || [];
      const response = new Response(
        `data: {"type":"status","message":"Generated"}\n\n` +
        `data: {"type":"stream","text":"// generated code"}\n\n` +
        `data: {"type":"complete","generatedCode":"<html></html>"}\n\n`,
        {
          headers: { 'Content-Type': 'text/event-stream' },
        }
      );
      await route.fulfill({ status: 200, body: await response.text(), contentType: 'text/event-stream' });
    });

    // Intercept sandbox creation
    await page.route('**/api/create-ai-sandbox-v2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sandboxId: 'test-sandbox',
          url: 'https://test-sandbox.example.com',
          success: true,
          structure: { files: [] },
        }),
      });
    });

    // Intercept sandbox files
    await page.route('**/api/get-sandbox-files', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: {} }),
      });
    });

    // Intercept screenshot API
    await page.route('**/api/scrape-screenshot', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, screenshot: null }),
      });
    });

    await page.goto('/generation');
    await page.waitForTimeout(10000);

    // Verify that download commands were issued for both images
    expect(downloadCommands.length).toBeGreaterThanOrEqual(1);
    expect(downloadCommands.some(cmd => cmd.includes('logo.png'))).toBeTruthy();
    expect(downloadCommands.some(cmd => cmd.includes('banner.jpg'))).toBeTruthy();

    // Verify that the content sent to generate-multi-page has local paths
    expect(sentPages.length).toBeGreaterThanOrEqual(1);
    expect(sentPages[0].content.includes('/images/')).toBeTruthy();
  });
});
