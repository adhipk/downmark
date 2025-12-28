import type { PageData } from "./types.ts";

/**
 * Processed content with optional metadata enhancements
 */
export interface ProcessedContent {
  html: string;
  metadata: Record<string, any>;
  rendererName?: string;
  processingNotes?: string[];
}

/**
 * Response data including display metadata
 */
export interface RendererResponse {
  content: string; // Final HTML content
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    siteName?: string;
    favicon?: string;
    canonical?: string;
    [key: string]: any;
  };
  // Out-of-band swaps for metadata panel
  metadataPanel?: string;
}

/**
 * Base interface that all renderers must implement
 */
export interface IRenderer {
  /**
   * Unique identifier for this renderer
   */
  readonly name: string;

  /**
   * Human-readable description
   */
  readonly description: string;

  /**
   * Domain patterns this renderer matches
   * Examples: ["*.wikipedia.org", "en.wikipedia.org"]
   */
  readonly patterns: string[];

  /**
   * Priority for pattern matching (higher = checked first)
   * Default: 0
   */
  readonly priority: number;

  /**
   * Process raw page data into cleaned content
   * This is the main customization point for site-specific logic
   */
  process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> | ProcessedContent;

  /**
   * Format processed content into HTTP response data
   * Default implementation provided by BaseRenderer
   */
  format(processed: ProcessedContent, sourceUrl: string): Promise<RendererResponse> | RendererResponse;
}
