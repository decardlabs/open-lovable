import { NextRequest, NextResponse } from 'next/server';

function sanitizeQuotes(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[«»]/g, '"')
    .replace(/[‹›]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/[ ]/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    console.log('[scrape-url-enhanced] Scraping:', url);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not set');

    let markdown = '';
    let screenshotUrl: string | null = null;
    let metadata: any = {};
    let title = '';
    let description = '';

    // Try v2 API first (more reliable for content + screenshot)
    try {
      const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'screenshot'],
          timeout: 45000,
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.data) {
          markdown = data.data.markdown || '';
          screenshotUrl = data.data.screenshot || null;
          metadata = data.data.metadata || {};
          title = metadata.title || '';
          description = metadata.description || '';
        }
      }
    } catch (e) {
      console.log('[scrape-url-enhanced] v2 scrape failed:', e);
    }

    // If no screenshot from v2, try screenshot-only
    if (!screenshotUrl) {
      try {
        const ssResp = await fetch('https://api.firecrawl.dev/v2/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url,
            formats: ['screenshot'],
            timeout: 30000,
          })
        });
        if (ssResp.ok) {
          const ssData = await ssResp.json();
          if (ssData.success && ssData.data) {
            screenshotUrl = ssData.data.screenshot || null;
            metadata = ssData.data.metadata || metadata;
            title = title || metadata.title || '';
            description = description || metadata.description || '';
          }
        }
      } catch (e) {
        console.log('[scrape-url-enhanced] screenshot-only fallback failed:', e);
      }
    }

    const sanitizedMarkdown = sanitizeQuotes(markdown || '');

    const formattedContent = `
Title: ${sanitizeQuotes(title || url)}
Description: ${sanitizeQuotes(description || '')}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();

    return NextResponse.json({
      success: true,
      url,
      content: formattedContent,
      screenshot: screenshotUrl,
      structured: {
        title: sanitizeQuotes(title || url),
        description: sanitizeQuotes(description || ''),
        content: sanitizedMarkdown,
        url,
        screenshot: screenshotUrl
      },
      metadata: {
        scraper: 'firecrawl-enhanced',
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        ...metadata
      },
      message: 'URL scraped successfully' + (screenshotUrl ? ' (with screenshot)' : '')
    });

  } catch (error) {
    console.error('[scrape-url-enhanced] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
