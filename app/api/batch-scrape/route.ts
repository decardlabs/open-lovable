import { NextRequest } from 'next/server';
import type { BatchScrapeEvent } from '@/types/multi-page';

export const dynamic = 'force-dynamic';

function extractImages(markdown: string): string[] {
  const urls: string[] = [];
  // Markdown images: ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  // HTML img tags: <img src="url">
  const htmlRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  while ((match = htmlRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  return [...new Set(urls)]; // Deduplicate
}

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
        const sendEvent = (data: BatchScrapeEvent) => {
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
                  const markdown = data.data.markdown || '';
                  sendEvent({
                    type: 'page-done',
                    url,
                    title: data.data.metadata?.title || url,
                    content: markdown,
                    screenshot: data.data.screenshot || null,
                    images: extractImages(markdown),
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
