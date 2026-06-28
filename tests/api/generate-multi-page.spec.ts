import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('POST /api/generate-multi-page', () => {
  test('returns SSE stream for valid request', async ({ request }) => {
    const response = await request.post(`${BASE}/api/generate-multi-page`, {
      data: {
        pages: [
          { url: '/', title: 'Home', content: '# Home Page\nWelcome to our site', screenshot: null },
          { url: '/about', title: 'About', content: '# About Us\nWe are a company', screenshot: null },
        ],
        model: 'openai/deepseek-v4-flash',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const body = await response.text();
    expect(body).toContain('data:');
  });

  test('returns 400 for empty pages', async ({ request }) => {
    const response = await request.post(`${BASE}/api/generate-multi-page`, {
      data: { pages: [], model: 'openai/deepseek-v4-flash' },
    });
    expect(response.status()).toBe(400);
  });

  test('accepts imagePaths field without error', async ({ request }) => {
    const response = await request.post(`${BASE}/api/generate-multi-page`, {
      data: {
        pages: [
          {
            url: '/',
            title: 'Home',
            content: 'Welcome! ![](https://example.com/hero.jpg)',
            screenshot: null,
            images: ['https://example.com/hero.jpg'],
          },
        ],
        model: 'openai/deepseek-v4-flash',
        imagePaths: { 'https://example.com/hero.jpg': '/images/img_0.jpg' },
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/event-stream');
    const body = await response.text();
    expect(body).toContain('data:');
    // The system prompt (sent to the LLM, not returned in the SSE stream) tells
    // the model to reference local /images/ paths. This validates the route
    // accepted imagePaths and processed them without error.
    expect(body).not.toContain('error');
  });
});
