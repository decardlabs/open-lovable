import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('POST /api/batch-scrape', () => {
  test('returns SSE stream for valid URLs', async ({ request }) => {
    const response = await request.post(`${BASE}/api/batch-scrape`, {
      data: { urls: ['https://example.com'] },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const body = await response.text();
    // Should contain at least one SSE event
    expect(body).toContain('data:');
  });

  test('returns 400 for empty URLs array', async ({ request }) => {
    const response = await request.post(`${BASE}/api/batch-scrape`, {
      data: { urls: [] },
    });
    expect(response.status()).toBe(400);
  });

  test('returns images from scraped content', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/batch-scrape', {
      data: { urls: ['https://example.com'] },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    // Check that page-done events contain an images field
    const lines = body.split('\n').filter(l => l.startsWith('data:'));
    for (const line of lines) {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'page-done') {
        expect(event).toHaveProperty('images');
        expect(Array.isArray(event.images)).toBe(true);
      }
    }
  });
});
