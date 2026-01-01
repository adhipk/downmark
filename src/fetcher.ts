/**
 * Smart HTML fetcher with fallback strategy
 * - Uses lightweight fetch() by default
 * - Falls back to Chrome for JS-heavy sites
 */

import { getPageData } from "./browser.ts";

// Domains that are known to require JavaScript
const JS_REQUIRED_DOMAINS = [
  "twitter.com",
  "x.com",
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "reddit.com",
  "medium.com",
  "substack.com",
  "github.com",
];

// User agents for fetch requests
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function requiresJavaScript(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return JS_REQUIRED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Fetch HTML using simple HTTP request
 */
async function fetchWithHttp(url: string): Promise<string> {
  const userAgent = randomChoice(USER_AGENTS);

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // Check if the response is actually HTML
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected HTML but got ${contentType}`);
  }

  return html;
}

/**
 * Detect if HTML content indicates JavaScript is required
 */
function detectJsRequired(html: string): boolean {
  const lowercaseHtml = html.toLowerCase();

  // Check for common indicators that JS is required
  const jsIndicators = [
    "enable javascript",
    "javascript is required",
    "javascript disabled",
    "noscript",
    "please enable javascript",
    "this page requires javascript",
  ];

  return jsIndicators.some(indicator => lowercaseHtml.includes(indicator));
}

export interface FetchResult {
  html: string;
  method: "fetch" | "chrome";
  url: string;
  metadata?: Record<string, string>;
}

/**
 * Smart fetch with automatic fallback
 */
export async function smartFetch(url: string, options: {
  forceBrowser?: boolean;
  extractMetadata?: boolean;
} = {}): Promise<FetchResult> {
  const { forceBrowser = false, extractMetadata = false } = options;

  // Force browser mode if explicitly requested
  if (forceBrowser) {
    console.log(`[Fetcher] Using Chrome (forced) for ${url}`);
    const pageData = await getPageData(url, {
      extractVisibility: false,
      extractImages: false,
      extractCss: false,
    });
    return {
      html: pageData.html,
      method: "chrome",
      url,
      metadata: pageData.metadata,
    };
  }

  // Check if domain is known to require JS
  if (requiresJavaScript(url)) {
    console.log(`[Fetcher] Using Chrome (known JS-heavy domain) for ${url}`);
    const pageData = await getPageData(url, {
      extractVisibility: false,
      extractImages: false,
      extractCss: false,
    });
    return {
      html: pageData.html,
      method: "chrome",
      url,
      metadata: pageData.metadata,
    };
  }

  // Try simple fetch first
  try {
    console.log(`[Fetcher] Attempting simple fetch for ${url}`);
    const html = await fetchWithHttp(url);

    // Check if the HTML indicates JS is required
    if (detectJsRequired(html)) {
      console.log(`[Fetcher] Detected JS requirement, falling back to Chrome for ${url}`);
      const pageData = await getPageData(url, {
        extractVisibility: false,
        extractImages: false,
        extractCss: false,
      });
      return {
        html: pageData.html,
        method: "chrome",
        url,
        metadata: pageData.metadata,
      };
    }

    // Extract basic metadata from HTML if requested
    let metadata: Record<string, string> | undefined;
    if (extractMetadata) {
      metadata = extractMetadataFromHtml(html);
    }

    console.log(`[Fetcher] Successfully fetched with simple HTTP for ${url}`);
    return {
      html,
      method: "fetch",
      url,
      metadata,
    };
  } catch (error: any) {
    console.log(`[Fetcher] Fetch failed (${error.message}), falling back to Chrome for ${url}`);
    const pageData = await getPageData(url, {
      extractVisibility: false,
      extractImages: false,
      extractCss: false,
    });
    return {
      html: pageData.html,
      method: "chrome",
      url,
      metadata: pageData.metadata,
    };
  }
}

/**
 * Extract basic metadata from HTML without browser
 */
function extractMetadataFromHtml(html: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract meta tags (simple regex approach)
  const metaRegex = /<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["'][^>]*?\s+content=["']([^"']+)["'][^>]*?>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    metadata[match[1]] = match[2];
  }

  // Extract canonical URL
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*?>/i);
  if (canonicalMatch) {
    metadata.canonical = canonicalMatch[1];
  }

  // Extract lang attribute
  const langMatch = html.match(/<html[^>]*?\s+lang=["']([^"']+)["'][^>]*?>/i);
  if (langMatch) {
    metadata.lang = langMatch[1];
  }

  return metadata;
}
