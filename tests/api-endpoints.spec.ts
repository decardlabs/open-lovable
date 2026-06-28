import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const BASE = 'http://localhost:3001';

  test('4.1 - POST /api/search returns results', async ({ request }) => {
    const response = await request.post(`${BASE}/api/search`, {
      data: { query: 'test website' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
  });

  test('4.2 - POST /api/scrape-screenshot returns screenshot URL', async ({ request }) => {
    const response = await request.post(`${BASE}/api/scrape-screenshot`, {
      data: { url: 'https://example.com' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.screenshot).toContain('https://');
  });

  test('4.3 - POST /api/scrape-url-enhanced returns content', async ({ request }) => {
    const response = await request.post(`${BASE}/api/scrape-url-enhanced`, {
      data: { url: 'https://example.com' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('content');
    expect(body).toHaveProperty('structured');
  });

  test('4.4 - GET /api/sandbox-status returns status', async ({ request }) => {
    const response = await request.get(`${BASE}/api/sandbox-status`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Should at least have active/healthy fields
    expect(body).toHaveProperty('active');
  });

  test('4.5 - POST /api/conversation-state works', async ({ request }) => {
    // Clear old conversation
    const response = await request.post(`${BASE}/api/conversation-state`, {
      data: { action: 'clear-old' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('4.5b - GET /api/conversation-state returns current state', async ({ request }) => {
    const response = await request.get(`${BASE}/api/conversation-state`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Response has state nested inside
    expect(body.state || body).toHaveProperty('conversationId');
  });

  test('POST /api/search with empty query returns 400', async ({ request }) => {
    const response = await request.post(`${BASE}/api/search`, {
      data: { query: '' },
    });
    // Empty query should return 400 (validation error)
    expect(response.status()).toBe(400);
  });
});
