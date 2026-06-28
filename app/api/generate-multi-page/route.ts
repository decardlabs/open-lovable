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

    // Build image path section if images are available
    let imageSection = '';
    if (body.imagePaths) {
      const entries = Object.entries(body.imagePaths);
      if (entries.length > 0) {
        const localPaths = entries.map(([, local]) => local);
        imageSection = `

AVAILABLE IMAGES (stored locally):
${localPaths.map((p) => `- ${p}`).join('\n')}

Use <img src="${localPaths[0].replace(/\/[^/]*$/, '/')}filename.jpg" /> to reference these images in your components.
The images are already downloaded to the sandbox's /public/images/ directory.
`;
      }
    }

    const modelName = body.model.replace('openai/', '');

    const systemPrompt = `You are generating a complete multi-page React single-page application using react-router-dom v6.

CRITICAL — FAILURE IF VIOLATED:
1. ALL internal navigation MUST use react-router-dom <Link to="/path"> — NEVER use <a href="..."> for internal links
2. Each page MUST be a separate file in src/pages/ — do NOT put page components in src/components/
3. The Header/Navbar MUST use <Link to="/page-name"> — never <a href="#hash">
4. src/App.jsx MUST configure BrowserRouter + Routes with one Route per page
5. src/components/Layout.jsx must use <Outlet /> from react-router-dom to render child pages
6. Every page component in src/pages/ must be a default export: export default function PageName()

REQUIREMENTS:
1. Create a full SPA with react-router-dom v6 (BrowserRouter, Routes, Route, Link, Outlet)
2. Each page is a separate component in src/pages/
3. Shared components in src/components/: Layout.jsx, Header.jsx, Footer.jsx
4. App.jsx configures BrowserRouter + Routes
5. Use Tailwind CSS for all styling
6. Consistent design language across all pages
7. The app MUST be a valid, complete React application
8. All .jsx files — no TypeScript syntax (no : type annotations, no generics)

PAGES TO CREATE:
${pagesSection}
${imageSection}
FILE STRUCTURE:
- src/App.jsx - BrowserRouter + Routes (one Route per page, nested under Layout with Outlet)
- src/main.jsx - Entry point
- src/index.css - Tailwind imports
- src/components/Layout.jsx - Layout with Header + <Outlet/> + Footer
- src/components/Header.jsx - Navigation bar with <Link> components
- src/components/Footer.jsx - Site footer
- src/pages/{PageName}.jsx - One component per page (e.g. src/pages/Home.jsx, src/pages/About.jsx)

EXAMPLE — App.jsx routing pattern:
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
...
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          ...
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

EXAMPLE — Header.jsx navigation (use Link, not <a>):
import { Link } from 'react-router-dom';
...
<nav>
  <Link to="/">Home</Link>
  <Link to="/about">About</Link>
  ...
</nav>

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
