// tests/api/website-map.spec.ts
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('POST /api/website-map', () => {
  test('returns mapped pages for a valid URL', async ({ request }) => {
    const response = await request.post(`${BASE}/api/website-map`, {
      data: { url: 'https://example.com' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('pages');
    expect(Array.isArray(body.pages)).toBe(true);
    if (body.pages.length > 0) {
      expect(body.pages[0]).toHaveProperty('path');
      expect(body.pages[0]).toHaveProperty('title');
      expect(body.pages[0]).toHaveProperty('depth');
    }
  });

  test('returns 400 for missing URL', async ({ request }) => {
    const response = await request.post(`${BASE}/api/website-map`, {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test('returns 400 for empty URL', async ({ request }) => {
    const response = await request.post(`${BASE}/api/website-map`, {
      data: { url: '' },
    });
    expect(response.status()).toBe(400);
  });
});
