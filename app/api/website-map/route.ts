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

    // Firecrawl v2/map returns links as an array of { url: string, title?: string, description?: string }
    const rawLinks: Array<{ url: string; title?: string; description?: string }> =
      data?.links || data?.data?.links || [];

    const baseUrl = new URL(url.trim());
    const pages: MappedPage[] = rawLinks
      .filter((link) => {
        try {
          const linkUrl = new URL(link.url);
          // Only include same-origin links, exclude sitemap.xml
          return linkUrl.hostname === baseUrl.hostname && !link.url.endsWith('sitemap.xml') && link.url !== baseUrl.origin + '/undefined';
        } catch {
          return false;
        }
      })
      .map((link) => {
        const linkUrl = new URL(link.url);
        const path = linkUrl.pathname || '/';
        const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
        // Use the title from Firecrawl if available, otherwise derive from path
        const title = link.title || (path === '/' ? '首页' : path.split('/').filter(Boolean).pop() || '页面');
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
