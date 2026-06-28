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
  | { type: 'page-done'; url: string; title: string; content: string; screenshot: string | null; images: string[] }
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
