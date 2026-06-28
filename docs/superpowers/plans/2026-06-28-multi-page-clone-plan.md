# Multi-Page Website Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Open Lovable's single-page clone to support multi-page website cloning: Map → select pages → batch scrape → AI generate react-router SPA.

**Architecture:** Three new API endpoints (website-map, batch-scrape, generate-multi-page) + UI page selector component + modified landing and generation pages. Reuses existing sandbox, code application, and preview infrastructure.

**Tech Stack:** Next.js 15 API routes, Firecrawl v2/v1 API, @ai-sdk/openai for AI generation, SSE for streaming, Tailwind CSS, 本地沙箱 (local provider).

## Global Constraints

- All Firecrawl API calls use direct `fetch` (not SDK) for region compatibility
- No `actions` parameter in Firecrawl requests
- Existing single-page flow must remain untouched
- Must use TDD: write failing test → implement → verify pass → commit per step
- React SPA output uses react-router-dom v6 with `BrowserRouter` + `Routes`
- Max concurrency for batch scrape: 3 parallel requests
- All new API routes use SSE for streaming where applicable
- Tests use Playwright (Chromium, headless)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `types/multi-page.ts` | Type definitions: MappedPage, BatchScrapeResult, MultiPageGenerationRequest |
| `app/api/website-map/route.ts` | Firecrawl v2/map -> return page tree |
| `app/api/batch-scrape/route.ts` | Concurrent scrape of multiple URLs via SSE |
| `app/api/generate-multi-page/route.ts` | AI generation of complete SPA from multi-page content |
| `components/app/(home)/sections/hero-input/PageSelector.tsx` | Page tree UI with checkboxes |
| `tests/website-map.spec.ts` | Tests for website-map API |
| `tests/batch-scrape.spec.ts` | Tests for batch-scrape API |
| `tests/multi-page-ui.spec.ts` | Tests for page selector UI |

### Modified Files
| File | Change |
|------|--------|
| `types/conversation.ts` | Add multi-page metadata to ConversationMessage |
| `config/app.config.ts` | Add multi-page max pages, default selections |
| `app/page.tsx` | Add single/multi-page toggle and PageSelector integration |
| `app/generation/page.tsx` | Add multi-page flow states and progress display |

---

### Task 1: Multi-Page Types

**Files:**
- Create: `types/multi-page.ts`

**Interfaces:**
- Produces: `MappedPage`, `BatchScrapeRequest`, `BatchScrapeResult`, `BatchScrapeEvent`, `MultiPageGenerationRequest`, `MultiPageGenerationPage` types used by all subsequent tasks.

- [ ] **Step 1: Write the failing test (type compilation check)**

Create a type-check file that uses the new types:

```typescript
// tests/types/multi-page-types-check.ts
import type {
  MappedPage,
  BatchScrapeEvent,
  MultiPageGenerationRequest,
  MultiPageGenerationPage,
} from '@/types/multi-page';

// If types are correct, this file compiles without errors
const page: MappedPage = {
  path: '/test',
  title: 'Test Page',
  depth: 1,
};

const startEvent: BatchScrapeEvent = {
  type: 'page-start',
  url: 'https://example.com/test',
  index: 0,
  total: 2,
};

const doneEvent: BatchScrapeEvent = {
  type: 'page-done',
  url: 'https://example.com/test',
  title: 'Test',
  content: '# Content',
  screenshot: null,
};

const completeEvent: BatchScrapeEvent = {
  type: 'complete',
  totalPages: 2,
  successfulPages: 2,
};

const genPage: MultiPageGenerationPage = {
  url: '/',
  title: 'Home',
  content: '# Home page content',
  screenshot: null,
};

const genRequest: MultiPageGenerationRequest = {
  pages: [genPage],
  model: 'openai/deepseek-v4-flash',
};

console.log('Types OK:', page, startEvent, doneEvent, completeEvent, genRequest);
```

- [ ] **Step 2: Verify compilation fails (no types file yet)**

Run: `npx tsc --noEmit tests/types/multi-page-types-check.ts 2>&1 || true`
Expected: Error about missing module `@/types/multi-page`

- [ ] **Step 3: Create the types file**

```typescript
// types/multi-page.ts

export interface MappedPage {
  path: string;
  title: string;
  depth: number;
}

export interface BatchScrapeRequest {
  urls: string[];
}

export type BatchScrapeEvent =
  | { type: 'page-start'; url: string; index: number; total: number }
  | { type: 'page-done'; url: string; title: string; content: string; screenshot: string | null }
  | { type: 'page-error'; url: string; error: string }
  | { type: 'complete'; totalPages: number; successfulPages: number };

export interface MultiPageGenerationPage {
  url: string;
  title: string;
  content: string;
  screenshot: string | null;
}

export interface MultiPageGenerationRequest {
  pages: MultiPageGenerationPage[];
  model: string;
}
```

- [ ] **Step 4: Verify compilation passes**

Run: `npx tsc --noEmit tests/types/multi-page-types-check.ts`
Expected: No output (success)

- [ ] **Step 5: Commit**

```bash
git add types/multi-page.ts tests/types/multi-page-types-check.ts
git commit -m "feat: add multi-page clone type definitions"
```

---

### Task 2: Config Updates

**Files:**
- Modify: `config/app.config.ts`

**Interfaces:**
- Consumes: (none)
- Produces: `appConfig.multiPage` settings object

- [ ] **Step 1: Write the failing test**

```typescript
// tests/config/multi-page-config.test.ts
import { appConfig } from '@/config/app.config';

describe('Multi-page config', () => {
  it('has multiPage section with defaults', () => {
    expect(appConfig.multiPage).toBeDefined();
    expect(appConfig.multiPage.maxConcurrency).toBe(3);
    expect(appConfig.multiPage.defaultSelectDepth).toBe(1);
    expect(appConfig.multiPage.defaultSelectedDepths).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run test — fails because multiPage not in config**

Run: `npx jest tests/config/multi-page-config.test.ts`
Expected: FAIL — `multiPage` is undefined

- [ ] **Step 3: Add multiPage section to appConfig**

```typescript
// In config/app.config.ts, after the existing sections, add:
multiPage: {
  // Max concurrent scrape requests
  maxConcurrency: 3,
  // Default depth to auto-select (0=root, 1=top-level sections)
  defaultSelectDepth: 1,
  // Depths to select by default
  defaultSelectedDepths: [0, 1],
  // Max pages allowed (safety limit)
  maxPages: 50,
},
```

- [ ] **Step 4: Run test — passes**

Run: `npx jest tests/config/multi-page-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config/app.config.ts tests/config/multi-page-config.test.ts
git commit -m "feat: add multi-page configuration"
```

---

### Task 3: API — POST /api/website-map

**Files:**
- Create: `app/api/website-map/route.ts`
- Test: `tests/api/website-map.test.ts`

**Interfaces:**
- Consumes: Firecrawl API `POST /v2/map`
- Produces: `{ success: true, url: string, pages: MappedPage[] }` JSON response

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/website-map.test.ts
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
```

- [ ] **Step 2: Run test — fails (route doesn't exist)**

Run: `npx playwright test tests/api/website-map.test.ts --config=tests/playwright.config.ts`
Expected: FAIL — 404

- [ ] **Step 3: Create the API route**

```typescript
// app/api/website-map/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { MappedPage } from '@/types/multi-page';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.firecrawl.dev/v2/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.trim(),
        limit: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[website-map] Firecrawl error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to map website' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Firecrawl v2/map returns data.links as string[]
    // or data.data.links depending on response format
    const links: string[] = data?.links || data?.data?.links || [];

    // Convert links to MappedPage[]
    const baseUrl = new URL(url.trim());
    const pages: MappedPage[] = links
      .filter((link: string) => {
        try {
          const linkUrl = new URL(link);
          // Only include same-origin links
          return linkUrl.hostname === baseUrl.hostname;
        } catch {
          return false;
        }
      })
      .map((link: string) => {
        const linkUrl = new URL(link);
        const path = linkUrl.pathname || '/';
        const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
        // Generate a title from the path
        const title = path === '/'
          ? '首页'
          : path.split('/').filter(Boolean).pop() || '页面';
        return { path, title, depth };
      });

    // Deduplicate by path
    const seen = new Set<string>();
    const uniquePages = pages.filter(p => {
      if (seen.has(p.path)) return false;
      seen.add(p.path);
      return true;
    });

    return NextResponse.json({
      success: true,
      url: url.trim(),
      pages: uniquePages,
    });
  } catch (error) {
    console.error('[website-map] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test — passes**

Run: `npx playwright test tests/api/website-map.test.ts --config=tests/playwright.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/website-map/route.ts tests/api/website-map.test.ts
git commit -m "feat: add website-map API endpoint"
```

---

### Task 4: API — POST /api/batch-scrape (SSE)

**Files:**
- Create: `app/api/batch-scrape/route.ts`
- Test: `tests/api/batch-scrape.test.ts`

**Interfaces:**
- Consumes: `BatchScrapeRequest`, Firecrawl API `POST /v2/scrape`
- Produces: SSE stream of `BatchScrapeEvent` events

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/batch-scrape.test.ts
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
});
```

- [ ] **Step 2: Run test — fails**

Run: `npx playwright test tests/api/batch-scrape.test.ts --config=tests/playwright.config.ts`
Expected: FAIL

- [ ] **Step 3: Create the API route**

```typescript
// app/api/batch-scrape/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'URLs array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let successfulPages = 0;
        const total = urls.length;
        const maxConcurrency = 3;

        // Process URLs in batches of maxConcurrency
        for (let i = 0; i < urls.length; i += maxConcurrency) {
          const batch = urls.slice(i, i + maxConcurrency);
          await Promise.all(
            batch.map(async (url: string, batchIndex: number) => {
              const globalIndex = i + batchIndex;
              sendEvent({ type: 'page-start', url, index: globalIndex, total });

              try {
                const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url,
                    formats: ['markdown', 'screenshot'],
                    timeout: 45000,
                  }),
                });

                if (!resp.ok) {
                  sendEvent({ type: 'page-error', url, error: `HTTP ${resp.status}` });
                  return;
                }

                const data = await resp.json();
                if (data.success && data.data) {
                  successfulPages++;
                  sendEvent({
                    type: 'page-done',
                    url,
                    title: data.data.metadata?.title || url,
                    content: data.data.markdown || '',
                    screenshot: data.data.screenshot || null,
                  });
                } else {
                  sendEvent({ type: 'page-error', url, error: data.error || 'Scrape failed' });
                }
              } catch (err) {
                sendEvent({ type: 'page-error', url, error: (err as Error).message });
              }
            })
          );
        }

        sendEvent({ type: 'complete', totalPages: total, successfulPages });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[batch-scrape] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

- [ ] **Step 4: Run test — passes**

Run: `npx playwright test tests/api/batch-scrape.test.ts --config=tests/playwright.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/batch-scrape/route.ts tests/api/batch-scrape.test.ts
git commit -m "feat: add batch-scrape SSE API endpoint"
```

---

### Task 5: API — POST /api/generate-multi-page (SSE)

**Files:**
- Create: `app/api/generate-multi-page/route.ts`
- Test: `tests/api/generate-multi-page.test.ts`

**Interfaces:**
- Consumes: `MultiPageGenerationRequest`, `@ai-sdk/openai` (openai.chat)
- Produces: SSE stream of file generation events (status, file, complete)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/generate-multi-page.test.ts
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
});
```

- [ ] **Step 2: Run test — fails**

Run: `npx playwright test tests/api/generate-multi-page.test.ts --config=tests/playwright.config.ts`
Expected: FAIL

- [ ] **Step 3: Create the API route**

```typescript
// app/api/generate-multi-page/route.ts
import { NextRequest } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { MultiPageGenerationRequest } from '@/types/multi-page';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: MultiPageGenerationRequest = await request.json();

    if (!body.pages || body.pages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one page is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });

    // Build the structured prompt with all pages
    const pagesSection = body.pages.map((page, i) => {
      return `===== Page ${i + 1}/${body.pages.length}: ${page.title} (${page.url}) =====
Content:
${page.content || '(No content available — generate based on title)'}
`;
    }).join('\n\n');

    const modelName = body.model.replace('openai/', '');

    const systemPrompt = `You are generating a complete multi-page React single-page application using react-router-dom v6.

REQUIREMENTS:
1. Create a full SPA with react-router-dom v6 (BrowserRouter, Routes, Route, Link)
2. Each page is a separate component in src/pages/
3. Shared components in src/components/: Layout.jsx, Header.jsx, Navbar.jsx, Footer.jsx
4. App.jsx configures BrowserRouter + Routes
5. Use Tailwind CSS for all styling
6. Consistent design language across all pages
7. The app MUST be a valid, complete React application

PAGES TO CREATE:
${pagesSection}

FILE STRUCTURE:
- src/App.jsx - Router config with all routes
- src/main.jsx - Entry point
- src/index.css - Tailwind imports
- src/components/Layout.jsx - Layout with Header + main + Footer
- src/components/Header.jsx - Navigation bar with Links
- src/components/Footer.jsx - Site footer
- src/pages/{PageName}.jsx - One per page

OUTPUT FORMAT:
Wrap each file in <file path="src/...">...</file> tags.
Example:
<file path="src/App.jsx">
import { BrowserRouter, Routes, Route } from 'react-router-dom';
...
</file>`;

    const stream = streamText({
      model: openai.chat(modelName),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a complete React SPA with ${body.pages.length} pages based on the content above.` },
      ],
      temperature: 0.7,
      maxTokens: 8000,
    });

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream.textStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stream', text: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[generate-multi-page] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

- [ ] **Step 4: Run test — passes**

Run: `npx playwright test tests/api/generate-multi-page.test.ts --config=tests/playwright.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/generate-multi-page/route.ts tests/api/generate-multi-page.test.ts
git commit -m "feat: add generate-multi-page SSE API endpoint"
```

---

### Task 6: PageSelector Component

**Files:**
- Create: `components/app/(home)/sections/hero-input/PageSelector.tsx`
- Modify: `app/page.tsx` (add toggle + PageSelector)
- Test: `tests/page-selector.spec.ts`

**Interfaces:**
- Consumes: `MappedPage[]` from website-map API
- Produces: Selected page list (user picks) → triggers multi-page flow

- [ ] **Step 1: Write the failing test**

```typescript
// tests/page-selector.spec.ts
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
});
```

- [ ] **Step 2: Run test — fails**

Run: `npx playwright test tests/page-selector.spec.ts --config=tests/playwright.config.ts`
Expected: FAIL (components don't exist yet)

- [ ] **Step 3: Create the PageSelector component**

```typescript
// components/app/(home)/sections/hero-input/PageSelector.tsx
'use client';

import { useState } from 'react';
import type { MappedPage } from '@/types/multi-page';

interface PageSelectorProps {
  pages: MappedPage[];
  onSelectionChange: (selected: MappedPage[]) => void;
  onStartClone: () => void;
  isMapLoading?: boolean;
}

export default function PageSelector({
  pages,
  onSelectionChange,
  onStartClone,
  isMapLoading = false,
}: PageSelectorProps) {
  // Default: select root + depth 1
  const defaultSelected = new Set(
    pages.filter(p => p.depth <= 1).map(p => p.path)
  );
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  const [selectAll, setSelectAll] = useState(false);

  const togglePage = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelected(next);
    const selectedPages = pages.filter(p => next.has(p.path));
    onSelectionChange(selectedPages);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      onSelectionChange([]);
    } else {
      const all = new Set(pages.map(p => p.path));
      setSelected(all);
      onSelectionChange(pages);
    }
    setSelectAll(!selectAll);
  };

  if (isMapLoading) {
    return (
      <div className="py-4 px-2">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Discovering pages...</p>
      </div>
    );
  }

  if (pages.length === 0) return null;

  // Group pages by depth for indentation
  const renderPage = (page: MappedPage) => {
    const indent = page.depth * 20;
    return (
      <label
        key={page.path}
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
        style={{ marginLeft: `${indent}px` }}
      >
        <input
          type="checkbox"
          checked={selected.has(page.path)}
          onChange={() => togglePage(page.path)}
          className="rounded border-gray-300 text-heat-100 focus:ring-heat-100"
        />
        <span className="text-sm text-gray-800">{page.title}</span>
        <span className="text-xs text-gray-400 ml-auto">{page.path}</span>
      </label>
    );
  };

  const sortedPages = [...pages].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.path.localeCompare(b.path);
  });

  return (
    <div className="border-t border-gray-100 pt-3 mt-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-medium text-gray-600">
          已选 {selected.size}/{pages.length} 页
        </span>
        <button
          onClick={toggleSelectAll}
          className="text-xs text-heat-100 hover:text-heat-200 transition-colors"
        >
          {selectAll ? '取消全选' : '全选'}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
        {sortedPages.map(renderPage)}
      </div>
      <button
        onClick={onStartClone}
        disabled={selected.size === 0}
        className={`mt-3 w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${
          selected.size > 0
            ? 'bg-heat-100 hover:bg-heat-200 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        克隆所选 {selected.size > 0 ? `(${selected.size} 页)` : ''} 🚀
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add toggle + PageSelector to landing page**

In `app/page.tsx`, add a single/multi-page toggle near the style selector area, and integrate PageSelector when in multi-page mode with map results.

Key changes to `app/page.tsx`:
1. Add state: `const [multiPageMode, setMultiPageMode] = useState(false);`
2. Add state: `const [mappedPages, setMappedPages] = useState<MappedPage[]>([]);`
3. Add state: `const [isMapLoading, setIsMapLoading] = useState(false);`
4. Add state: `const [selectedPages, setSelectedPages] = useState<MappedPage[]>([]);`
5. Add toggle button next to "Extend brand styles"
6. When multi-page + Discover clicked → call `/api/website-map` → show PageSelector
7. When "克隆所选" clicked → store selected page info in sessionStorage → navigate to `/generation`

- [ ] **Step 5: Run tests — passes**

Run: `npx playwright test tests/page-selector.spec.ts --config=tests/playwright.config.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/app/\(home\)/sections/hero-input/PageSelector.tsx app/page.tsx tests/page-selector.spec.ts
git commit -m "feat: add page selector component and multi-page toggle"
```

---

### Task 7: Generation Page Multi-Page Integration

**Files:**
- Modify: `app/generation/page.tsx`

**Interfaces:**
- Consumes: sessionStorage multi-page data, batch-scrape API, generate-multi-page API
- Produces: Complete multi-page SPA applied to sandbox, preview with navigation

- [ ] **Step 1: Write the failing test**

```typescript
// tests/generation-page-multi.spec.ts
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
```

- [ ] **Step 2: Run test — fails**

Run: `npx playwright test tests/generation-page-multi.spec.ts --config=tests/playwright.config.ts`
Expected: FAIL

- [ ] **Step 3: Implement generation page changes**

Add to `app/generation/page.tsx`:

```typescript
// In the existing useEffect that checks sessionStorage on mount, add:
const multiPageMode = sessionStorage.getItem('multiPageMode') === 'true';
const multiPageCount = parseInt(sessionStorage.getItem('multiPageCount') || '0');

if (multiPageMode && !showHomeScreen) {
  addChatMessage(`Multi-page clone mode: ${multiPageCount} pages to generate`, 'system');
  // Add multi-page status indicator state
  setGenerationProgress(prev => ({
    ...prev,
    multiPageMode: true,
    multiPageTotal: multiPageCount,
    multiPageCurrent: 0,
  }));
}
```

In `startGeneration()`, add multi-page flow detection and the batch-scrape → generate-multi-page pipeline instead of the single-page scrape → generate flow.

Key additions:
1. State: `multiPageMode`, `multiPagePages`, `multiPageCurrent`, `multiPageTotal`
2. Flow: if multiPageMode → call batch-scrape first → then call generate-multi-page → apply code
3. Update progress overlay to show multi-page stages
4. Update file explorer to show multi-page structure

- [ ] **Step 4: Run tests — passes**

Run: `npx playwright test tests/generation-page-multi.spec.ts --config=tests/playwright.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/generation/page.tsx tests/generation-page-multi.spec.ts
git commit -m "feat: integrate multi-page clone flow in generation page"
```

---

### Task 8: End-to-End Test

**Files:**
- Create: `tests/e2e-multi-page.spec.ts`

- [ ] **Step 1: Write the E2E test**

```typescript
// tests/e2e-multi-page.spec.ts
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
```

- [ ] **Step 2: Run test — fails**

Run: `npx playwright test tests/e2e-multi-page.spec.ts --config=tests/playwright.config.ts`
Expected: FAIL (everything depends on previous tasks)

- [ ] **Step 3: Implement remaining UI integration**

Complete the integration by verifying all the pieces connect:
1. Landing page toggle works
2. Map API is called when "Discover Pages" clicked  
3. PageSelector renders with results
4. Clone button stores data in sessionStorage and navigates
5. Generation page picks up multi-page data and shows status

- [ ] **Step 4: Run E2E test — passes**

Run: `npx playwright test tests/e2e-multi-page.spec.ts --config=tests/playwright.config.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite for regression**

Run: `npx playwright test --config=tests/playwright.config.ts`
Expected: ALL PASS (existing tests + new tests)

- [ ] **Step 6: Commit**

```bash
git add tests/e2e-multi-page.spec.ts
git commit -m "test: add multi-page clone E2E test"
```

---

### Task 9: Regression Test & Cleanup

**Files:**
- Run existing full test suite

- [ ] **Step 1: Run all Playwright tests**

```bash
npx playwright test --config=tests/playwright.config.ts
```
Expected: ALL PASS

- [ ] **Step 2: Run existing API tests to confirm no regression**

```bash
npx playwright test tests/api-endpoints.spec.ts --config=tests/playwright.config.ts
```
Expected: ALL PASS

- [ ] **Step 3: Commit final changes**

```bash
git add -A
git commit -m "feat: complete multi-page clone implementation"
```
