import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'Firecrawl API key not configured'
      }, { status: 500 });
    }

    console.log('[scrape-screenshot] Capturing screenshot for:', url);

    // Use direct fetch to Firecrawl API - no custom actions (some regions restrict them)
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: url,
        formats: ['screenshot'],
        waitFor: 6000,
        timeout: 60000,
        onlyMainContent: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[scrape-screenshot] Firecrawl API error:', response.status, data);
      throw new Error(data.error || `Firecrawl API returned ${response.status}`);
    }

    if (data?.data?.screenshot) {
      return NextResponse.json({
        success: true,
        screenshot: data.data.screenshot,
        metadata: data.data.metadata || {}
      });
    } else {
      console.error('[scrape-screenshot] No screenshot in response:', JSON.stringify(data));
      throw new Error('Screenshot not available in response');
    }

  } catch (error: any) {
    console.error('[scrape-screenshot] Error:', error.message);
    return NextResponse.json({
      error: error.message || 'Failed to capture screenshot'
    }, { status: 500 });
  }
}
