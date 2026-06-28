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
