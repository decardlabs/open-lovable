# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server with Turbopack (http://localhost:3000)
pnpm build        # Production build (next build)
pnpm start        # Start production server (next start)
pnpm lint         # Run ESLint (next lint)
pnpm test:api     # Run API endpoint tests
pnpm test:code    # Run code execution tests
pnpm test:all     # Run all tests
```

## Project Overview

**Open Lovable** — Chat with AI to build React apps instantly. A Next.js app by the Firecrawl team. Users enter a URL or search term, select a model & style, then chat with an AI to generate React components that are applied to a live sandbox preview.

## Tech Stack

- **Framework:** Next.js 15 (App Router) with Turbopack, TypeScript, React 19
- **Styling:** Tailwind CSS 3 with custom pixel-based design system (colors from `colors.json` mapped to CSS variables)
- **State:** Jotai atoms (`atoms/`), local React state
- **Animation:** Framer Motion, Pixi.js
- **UI:** Radix UI primitives (dialog, dropdown, tabs, etc.), shadcn-style components, Tabler Icons, Lucide, react-syntax-highlighter
- **AI SDKs:** `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai`, plus direct SDKs (`@anthropic-ai/sdk`, `groq-sdk`)
- **Sandboxes:** Vercel Sandbox (`@vercel/sandbox`) or E2B (`@e2b/code-interpreter`)
- **Scraping:** Firecrawl JS SDK (`@mendable/firecrawl-js`)

## Architecture

### Routes (App Router)

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing page — URL input, style/model selection, search results carousel |
| `/generation` | `app/generation/page.tsx` | **Core app** — AI chat, sandbox preview, file explorer, code display |
| `/builder` | `app/builder/page.tsx` | Simple website rebuild from URL (generates static HTML) |

### API Endpoints (`app/api/`)

**Sandbox lifecycle:** `create-ai-sandbox`, `create-ai-sandbox-v2`, `kill-sandbox`, `sandbox-status`, `sandbox-logs`, `get-sandbox-files`
**AI Code Gen:** `generate-ai-code-stream` (SSE), `apply-ai-code-stream` (SSE), `apply-ai-code`
**Sandbox ops:** `run-command`, `run-command-v2`, `restart-vite`, `create-zip`
**Package mgmt:** `install-packages`, `install-packages-v2`, `detect-and-install-packages`
**Scraping:** `scrape-website`, `scrape-url-enhanced`, `scrape-screenshot`, `search`
**Vite errors:** `check-vite-errors`, `clear-vite-errors-cache`, `report-vite-error`, `monitor-vite-logs`
**Other:** `conversation-state`, `analyze-edit-intent`, `extract-brand-styles`

### Key Directories

- **`lib/`** — Core business logic
  - `lib/ai/provider-manager.ts` — Resolves model IDs (`openai/`, `anthropic/`, `google/`, `moonshotai/`) to AI SDK provider clients, with Vercel AI Gateway support
  - `lib/sandbox/` — Abstraction layer: `types.ts` (abstract `SandboxProvider` base class), `factory.ts` (creates provider), `sandbox-manager.ts` (singleton), `providers/e2b-provider.ts` & `vercel-provider.ts`
  - `lib/morph-fast-apply.ts` — MorphLLM API integration for fast code edits via `<edit>` blocks
  - `lib/edit-intent-analyzer.ts` — Classifies user prompts into `EditType` (UPDATE_COMPONENT, ADD_FEATURE, FIX_ISSUE, etc.) and resolves target files
  - `lib/context-selector.ts` — Builds enhanced system prompts with file structure, component relationships, and edit instructions
  - `lib/build-validator.ts` — Validates sandbox builds and classifies errors (missing-package, syntax-error, etc.)
  - `lib/file-parser.ts` — Vite error overlay parser
- **`components/`** — All React components
  - `components/app/` — App-specific sections (home page, generation sidebar)
  - `components/shared/` — Reusable: header, effects, icons, layout, preview (iframe), portal-to-body
  - `components/ui/` — Primitives: button, code, input, select, spinner, shadcn/* (Radix-based)
- **`atoms/`** — Jotai atoms (currently just `sheets.ts`)
- **`types/`** — TypeScript interfaces: `conversation.ts`, `file-manifest.ts`, `sandbox.ts`
- **`config/`** — `app.config.ts` (centralized settings: sandbox timeouts, AI models, delays, UI)
- **`styles/`** — Tailwind design system, component styles, additional styles
- **`hooks/`** — `useDebouncedCallback`, `useDebouncedEffect`, `useSwitchingCode`

### Design System

- Colors in `colors.json` → CSS custom properties → Tailwind classes (`var(--color-name)`)
- Tailwind config generates pixel-based spacing/sizing (`0`-`1000`px scale), opacity classes, and transition durations programmatically
- Zero-based grid: utilities like `p-24` = 24px padding, `gap-8` = 8px gap, `rounded-10` = 10px radius
- Custom `cmw-container`, `.connector`, and `.button` patterns used throughout

### Sandbox Provider Pattern

Abstract class `SandboxProvider` defines: `createSandbox`, `runCommand`, `writeFile`, `readFile`, `listFiles`, `installPackages`, `setupViteApp`, `restartViteServer`, `terminate`, `isAlive`. Two implementations:
- **Vercel** — uses `@vercel/sandbox` SDK, OIDC or PAT auth
- **E2B** — uses `@e2b/code-interpreter` SDK

Created via `SandboxFactory.create()` and managed by singleton `sandboxManager`.

### AI Provider Resolution

`getProviderForModel(modelId)` in `provider-manager.ts` routes model strings to the correct `@ai-sdk/*` provider client. Supports:
- Prefix routing: `anthropic/*` → Anthropic, `openai/*` → OpenAI, `google/*` → Google
- Special models: `moonshotai/kimi-k2-instruct-0905` → Groq
- Default fallback: Groq
- Optional Vercel AI Gateway override

### Key Data Flow (Generation)

1. User enters URL/search → Firecrawl scrape → screenshot + content
2. Sandbox created (Vercel or E2B) with Vite React app template
3. User chats → `generate-ai-code-stream` (SSE) → AI generates React files
4. Response parsed into `<file>` blocks → `apply-ai-code-stream` (SSE) writes to sandbox
5. Iframe preview refreshes → user sees live result
6. Subsequent messages are "edits" → `analyze-edit-intent` classifies, Morph or AI applies surgical changes

### Env Setup

Required: `FIRECRAWL_API_KEY`, at least one AI provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, or `AI_GATEWAY_API_KEY`). Sandbox: set `SANDBOX_PROVIDER=vercel` (default) or `e2b`, with corresponding auth keys. See `.env.example`.
