/**
 * Unified page fetching interface
 * Integrates smartFetch with existing PageData structure
 */

import { smartFetch } from "./fetcher.ts";
import { getPageData } from "./browser.ts";
import type { PageData } from "./types.ts";

export interface FetchOptions {
  forceBrowser?: boolean;
  extractVisibility?: boolean;
  extractImages?: boolean;
  extractCss?: boolean;
  collectCssClasses?: boolean;
}

/**
 * Fetch page data using smart fetch strategy
 * - Uses lightweight fetch() by default
 * - Falls back to Chrome when needed
 * - Compatible with existing PageData interface
 */
export async function fetchPageData(
  url: string,
  options: FetchOptions = {}
): Promise<PageData> {
  const {
    forceBrowser = false,
    extractVisibility = false,
    extractImages = false,
    extractCss = false,
    collectCssClasses = false,
  } = options;

  // If advanced features are needed, use browser
  if (extractVisibility || extractImages || extractCss || forceBrowser) {
    console.log(`[PageFetcher] Using browser for ${url}`);
    return await getPageData(url, {
      extractVisibility,
      extractImages,
      extractCss,
      collectCssClasses,
    });
  }

  // Use smart fetch for simple HTML retrieval
  try {
    const result = await smartFetch(url, {
      forceBrowser,
      extractMetadata: true,
    });

    // Log which method was used
    console.log(`[PageFetcher] Fetched ${url} using ${result.method}`);

    // Return in PageData format
    return {
      html: result.html,
      metadata: result.metadata || {},
      cssClasses: [],
    };
  } catch (error: any) {
    console.error(`[PageFetcher] Error fetching ${url}:`, error);
    throw error;
  }
}
