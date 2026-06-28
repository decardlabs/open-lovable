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
