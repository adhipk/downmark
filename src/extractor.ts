/**
 * Content extraction using Mozilla Readability
 */

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  lang: string | null;
}

export function extractContent(html: string, url: string): ExtractedContent | null {
  const { document } = parseHTML(html);
  
  const charThreshold = parseInt(process.env.EXTRACTOR_CHAR_THRESHOLD || "100", 10);
  const reader = new Readability(document, { charThreshold });
  const article = reader.parse();
  
  if (!article) return null;
  
  return {
    title: article.title || "",
    content: article.content || "",
    textContent: article.textContent || "",
    excerpt: article.excerpt || "",
    byline: article.byline,
    siteName: article.siteName,
    lang: article.lang,
  };
}

export function removeBoilerplate(html: string): string {
  const { document } = parseHTML(html);

  // Remove scripts, external stylesheet links, and boilerplate
  // Keep <style> tags for inline CSS
  const remove = [
    "nav", "header", "footer", "aside", ".sidebar", ".ads", ".comments",
    ".related-posts", ".advertisement", "script", "noscript",
    "link[rel='stylesheet']", // Remove external CSS links (already inlined)
  ];

  for (const sel of remove) {
    document.querySelectorAll(sel).forEach((el: Element) => el.remove());
  }

  const contentSel = ["article", "main", "[role='main']", ".content", "#content"];
  for (const sel of contentSel) {
    const el = document.querySelector(sel);
    if (el?.textContent && el.textContent.trim().length > 200) {
      return el.outerHTML;
    }
  }

  // Always return just the body innerHTML to avoid document-level tags
  // This prevents issues with htmx out-of-band swaps when concatenating HTML
  return document.body?.innerHTML || "";
}

/**
 * Detect and optionally remove hidden elements
 */
export function detectHiddenElements(html: string, remove: boolean = false): { html: string; stats: { hidden: number; offscreen: number; removed: number } } {
  const { document } = parseHTML(html);

  let hiddenCount = 0;
  let offscreenCount = 0;
  let removedCount = 0;

  const allElements = document.querySelectorAll('*');

  allElements.forEach((el: Element) => {
    // Check inline styles
    const style = el.getAttribute('style') || '';
    const classList = Array.from(el.classList);

    // Detect display:none, visibility:hidden, opacity:0
    const isDisplayNone = style.includes('display:none') || style.includes('display: none');
    const isVisibilityHidden = style.includes('visibility:hidden') || style.includes('visibility: hidden');
    const isOpacityZero = style.includes('opacity:0') || style.includes('opacity: 0');

    // Common hidden class names
    const hasHiddenClass = classList.some(cls =>
      cls.includes('hidden') ||
      cls.includes('hide') ||
      cls.includes('invisible') ||
      cls.includes('d-none') || // Bootstrap
      cls === 'hidden' ||
      cls === 'sr-only' || // Screen reader only
      cls.includes('off-screen')
    );

    if (isDisplayNone || isVisibilityHidden || isOpacityZero || hasHiddenClass) {
      hiddenCount++;
      if (remove) {
        el.remove();
        removedCount++;
      } else {
        // Mark for reference
        el.setAttribute('data-hidden', 'true');
      }
    }
  });

  return {
    html: document.toString(),
    stats: {
      hidden: hiddenCount,
      offscreen: offscreenCount,
      removed: removedCount,
    },
  };
}

/**
 * Extract all links from HTML and return them as a list
 */
export interface LinkInfo {
  url: string;
  text: string;
  title?: string;
}

export function extractAllLinks(html: string, baseUrl: string): LinkInfo[] {
  const { document } = parseHTML(html);
  const links: LinkInfo[] = [];
  const seen = new Set<string>();

  document.querySelectorAll('a[href]').forEach((anchor: Element) => {
    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip non-http links (mailto:, tel:, javascript:, etc.)
    if (href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('#')) {
      return;
    }

    // Convert relative URLs to absolute
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).href;
    } catch {
      return; // Invalid URL, skip
    }

    // Deduplicate links
    if (seen.has(absoluteUrl)) return;
    seen.add(absoluteUrl);

    links.push({
      url: absoluteUrl,
      text: anchor.textContent?.trim() || '',
      title: anchor.getAttribute('title') || undefined,
    });
  });

  return links;
}

/**
 * Transform images and SVGs to use absolute URLs
 */
export function transformImagesToAbsolute(html: string, baseUrl: string): string {
  const { document } = parseHTML(html);

  // Ensure baseUrl is treated as a directory for relative URL resolution
  // If the URL doesn't end with / and doesn't have a file extension, add /
  const normalizedBaseUrl = (() => {
    if (baseUrl.endsWith('/')) return baseUrl;
    const url = new URL(baseUrl);
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    // Check if it looks like a file (has a common file extension)
    const fileExtensions = ['.html', '.htm', '.php', '.asp', '.aspx', '.jsp', '.pdf', '.xml', '.json'];
    const hasFileExtension = fileExtensions.some(ext => lastPart.toLowerCase().endsWith(ext));

    // If no file extension, treat as directory and add trailing slash
    if (!hasFileExtension) {
      return baseUrl + '/';
    }
    return baseUrl;
  })();

  // Convert img src to absolute
  document.querySelectorAll('img[src]').forEach((img: Element) => {
    const src = img.getAttribute('src');
    if (!src) return;

    // Skip data URLs and already absolute URLs
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return;
    }

    try {
      const absoluteUrl = new URL(src, normalizedBaseUrl).href;
      img.setAttribute('src', absoluteUrl);
    } catch {
      // Invalid URL, skip
    }
  });

  // Convert img srcset to absolute
  document.querySelectorAll('img[srcset]').forEach((img: Element) => {
    const srcset = img.getAttribute('srcset');
    if (!srcset) return;

    try {
      const newSrcset = srcset.split(',').map(part => {
        const [url, descriptor] = part.trim().split(/\s+/);
        if (!url) return part;

        if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
          return part;
        }

        try {
          const absoluteUrl = new URL(url, normalizedBaseUrl).href;
          return descriptor ? `${absoluteUrl} ${descriptor}` : absoluteUrl;
        } catch {
          return part;
        }
      }).join(', ');

      img.setAttribute('srcset', newSrcset);
    } catch {
      // Invalid srcset, skip
    }
  });

  // Convert SVG image hrefs
  document.querySelectorAll('image[href], image[xlink\\:href]').forEach((img: Element) => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href');
    if (!href) return;

    if (href.startsWith('data:') || href.startsWith('http://') || href.startsWith('https://')) {
      return;
    }

    try {
      const absoluteUrl = new URL(href, normalizedBaseUrl).href;
      if (img.hasAttribute('href')) {
        img.setAttribute('href', absoluteUrl);
      }
      if (img.hasAttribute('xlink:href')) {
        img.setAttribute('xlink:href', absoluteUrl);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  // Convert picture source srcset
  document.querySelectorAll('source[srcset]').forEach((source: Element) => {
    const srcset = source.getAttribute('srcset');
    if (!srcset) return;

    try {
      const newSrcset = srcset.split(',').map(part => {
        const [url, descriptor] = part.trim().split(/\s+/);
        if (!url) return part;

        if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
          return part;
        }

        try {
          const absoluteUrl = new URL(url, normalizedBaseUrl).href;
          return descriptor ? `${absoluteUrl} ${descriptor}` : absoluteUrl;
        } catch {
          return part;
        }
      }).join(', ');

      source.setAttribute('srcset', newSrcset);
    } catch {
      // Invalid srcset, skip
    }
  });

  return document.toString();
}

/**
 * Transform all links to use htmx for in-app navigation
 */
export function transformLinksToHtmx(html: string, baseUrl: string): string {
  const { document } = parseHTML(html);

  document.querySelectorAll('a[href]').forEach((anchor: Element) => {
    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip non-http links (mailto:, tel:, javascript:, etc.)
    if (href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('#')) {
      return;
    }

    // Convert relative URLs to absolute
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).href;
    } catch {
      return; // Invalid URL, skip
    }

    // Check if this is an in-page link (same page with hash)
    // Remove hash fragments for comparison
    const absoluteUrlWithoutHash = absoluteUrl.split('#')[0];
    const baseUrlWithoutHash = baseUrl.split('#')[0];

    if (absoluteUrlWithoutHash === baseUrlWithoutHash && absoluteUrl.includes('#')) {
      // This is an in-page link to the current page, convert to hash-only
      const hashFragment = '#' + absoluteUrl.split('#')[1];
      anchor.setAttribute('href', hashFragment);
      return; // Don't add htmx attributes
    }

    // Add htmx attributes to load in-app
    anchor.setAttribute('hx-get', `/render?q=${encodeURIComponent(absoluteUrl)}`);
    anchor.setAttribute('hx-target', '#content');
    anchor.setAttribute('hx-indicator', '#loading');
    anchor.setAttribute('hx-push-url', 'false'); // Don't change browser URL

    // Keep original href for right-click "Open in new tab"
    anchor.setAttribute('href', absoluteUrl);
  });

  return document.toString();
}

