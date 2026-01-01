/**
 * Headless browser utilities using Puppeteer
 */

import puppeteer from "puppeteer";
import type { PageData } from "./types.ts";

// Realistic user agents (updated Dec 2024)
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
];

const HEADERS = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="131"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Browser singleton
let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-dev-shm-usage",
        "--lang=en-US,en",
      ],
    });
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function getPageData(url: string, options: {
  collectCssClasses?: boolean;
  extractVisibility?: boolean;
  extractImages?: boolean;
  extractCss?: boolean;
  blockResources?: boolean;
} = {}): Promise<PageData> {
  const {
    collectCssClasses = false,
    extractVisibility = false,
    extractImages = false,
    extractCss = false,
    blockResources = true, // Block images/fonts by default for speed
  } = options;
  const userAgent = randomChoice(USER_AGENTS);
  const viewport = randomChoice(VIEWPORTS);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders(HEADERS);

    // Block unnecessary resources for faster loading
    if (blockResources) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        // Block images, fonts, media, and other heavy resources
        if (['image', 'font', 'media', 'manifest', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    const waitStrategy = (process.env.BROWSER_WAIT_STRATEGY || "domcontentloaded") as "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    const browserTimeout = parseInt(process.env.BROWSER_TIMEOUT || "60000", 10);
    const waitTimeout = parseInt(process.env.BROWSER_WAIT_TIMEOUT || "15000", 10);
    const referer = process.env.BROWSER_REFERER || "https://www.google.com/";

    await page.goto(url, {
      waitUntil: waitStrategy,
      timeout: browserTimeout,
      referer: referer,
    });

    // Wait for any JS challenges to complete
    await page.waitForFunction(() => {
      const title = document.title;
      return !title.includes("Just a moment") && !title.includes("Checking");
    }, { timeout: waitTimeout }).catch(() => {});

  // Single combined page evaluation for all data extraction
  const allData = await page.evaluate((opts: {
    collectCssClasses: boolean;
    extractVisibility: boolean;
    extractImages: boolean;
    extractCss: boolean;
  }) => {
    const result: any = {
      html: '',
      metadata: {},
      cssClasses: [],
    };

    // Extract metadata (always needed, fast)
    const metadata: Record<string, string> = {};
    const title = document.querySelector("title");
    if (title) metadata.title = title.textContent || "";

    document.querySelectorAll("meta").forEach((meta) => {
      const name = meta.getAttribute("name") || meta.getAttribute("property");
      const content = meta.getAttribute("content");
      if (name && content) metadata[name] = content;
    });

    const canonical = document.querySelector("link[rel='canonical']");
    if (canonical) metadata.canonical = canonical.getAttribute("href") || "";
    if (document.documentElement.lang) metadata.lang = document.documentElement.lang;
    result.metadata = metadata;

    // Collect CSS classes if requested
    if (opts.collectCssClasses) {
      const classSet = new Set<string>();
      document.querySelectorAll("*").forEach((el) => {
        el.classList.forEach((cls) => classSet.add(cls));
      });
      result.cssClasses = Array.from(classSet).sort();
    }

    // Visibility detection (optional, expensive)
    if (opts.extractVisibility) {
      let hiddenElements = 0;
      let invisibleElements = 0;
      let offscreenElements = 0;
      let zeroOpacityElements = 0;

      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        const computed = window.getComputedStyle(el as HTMLElement);

        if (computed.display === 'none') {
          el.setAttribute('data-display-none', 'true');
          hiddenElements++;
          return;
        }
        if (computed.visibility === 'hidden') {
          el.setAttribute('data-visibility-hidden', 'true');
          invisibleElements++;
          return;
        }
        if (computed.opacity === '0') {
          el.setAttribute('data-opacity-zero', 'true');
          zeroOpacityElements++;
          return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          offscreenElements++;
        }
      });

      result.visibilityInfo = {
        totalElements: allElements.length,
        hiddenElements,
        invisibleElements,
        zeroOpacityElements,
        offscreenElements,
      };
    }

    // Image dimension extraction (optional, expensive)
    if (opts.extractImages) {
      let imagesAdded = 0;
      let svgsAdded = 0;
      let imagesWithDimensions = 0;
      let svgsWithDimensions = 0;

      const images = document.querySelectorAll('img');
      images.forEach((img: HTMLImageElement) => {
        const hadDimensions = img.hasAttribute('width') || img.hasAttribute('height');

        // Remove wrapper divs with padding-bottom hacks
        let parent = img.parentElement;
        while (parent && parent.tagName !== 'BODY') {
          const parentStyle = parent.getAttribute('style');
          if (parentStyle && parentStyle.includes('padding-bottom')) {
            parent.removeAttribute('style');
          }
          if (parent.className && (
            parent.className.includes('primary-image') ||
            parent.className.includes('image-container') ||
            parent.className.includes('img-wrapper')
          )) {
            parent.removeAttribute('style');
          }
          parent = parent.parentElement;
        }

        const computed = window.getComputedStyle(img);
        if (computed.display && !img.hasAttribute('data-original-display')) {
          img.setAttribute('data-original-display', computed.display);
        }

        if (!img.hasAttribute('width') && img.naturalWidth) {
          img.setAttribute('width', img.naturalWidth.toString());
          imagesAdded++;
        }
        if (!img.hasAttribute('height') && img.naturalHeight) {
          img.setAttribute('height', img.naturalHeight.toString());
          if (!img.hasAttribute('width') || !hadDimensions) imagesAdded++;
        }

        if (img.hasAttribute('width') && img.hasAttribute('height')) {
          imagesWithDimensions++;
        }

        if (img.hasAttribute('loading')) img.removeAttribute('loading');
        if (img.hasAttribute('onload')) img.removeAttribute('onload');
        if (img.hasAttribute('style')) img.removeAttribute('style');

        img.setAttribute('loading', 'eager');
        if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      });

      const svgs = document.querySelectorAll('svg');
      svgs.forEach((svg: SVGSVGElement) => {
        try {
          const bbox = svg.getBBox?.();
          if (bbox && !svg.hasAttribute('width') && !svg.hasAttribute('height')) {
            svg.setAttribute('width', Math.ceil(bbox.width).toString());
            svg.setAttribute('height', Math.ceil(bbox.height).toString());
            svgsAdded++;
          }
        } catch (e) {}

        if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
          svgsWithDimensions++;
        }

        if (!svg.hasAttribute('viewBox')) {
          const width = svg.getAttribute('width');
          const height = svg.getAttribute('height');
          if (width && height) {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
        }
      });

      result.imageInfo = {
        totalImages: images.length,
        totalSVGs: svgs.length,
        imagesWithDimensions,
        imagesAdded,
        svgsWithDimensions,
        svgsAdded,
      };
    }

    // CSS extraction (optional, very expensive)
    if (opts.extractCss) {
      const allCSS: string[] = [];
      const inlineStyles: string[] = [];
      let blockedStylesheets = 0;

      const makeUrlsAbsolute = (cssText: string): string => {
        const baseUrl = window.location.origin;
        const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

        return cssText.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
          if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
            return match;
          }

          try {
            const absoluteUrl = new URL(url, baseUrl + currentPath).href;
            return `url("${absoluteUrl}")`;
          } catch {
            return match;
          }
        });
      };

      const styleSheets = Array.from(document.styleSheets);
      styleSheets.forEach((sheet) => {
        try {
          if (sheet.cssRules) {
            const cssText = Array.from(sheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
            if (cssText) {
              allCSS.push(makeUrlsAbsolute(cssText));
            }
          }
        } catch (e) {
          blockedStylesheets++;
          if (sheet.href) {
            allCSS.push(`/* External stylesheet blocked by CORS: ${sheet.href} */`);
          }
        }
      });

      const elementsWithStyle = document.querySelectorAll('[style]');
      const styleMap = new Map<string, string[]>();

      elementsWithStyle.forEach((el) => {
        const style = el.getAttribute('style');
        if (style) {
          const tagName = el.tagName.toLowerCase();
          const className = el.className ? `.${Array.from(el.classList).join('.')}` : '';
          const selector = className || tagName;

          if (!styleMap.has(selector)) {
            styleMap.set(selector, []);
          }
          styleMap.get(selector)!.push(style);
        }
      });

      styleMap.forEach((styles, selector) => {
        const uniqueStyles = Array.from(new Set(styles));
        uniqueStyles.forEach(style => {
          inlineStyles.push(`${selector} { ${makeUrlsAbsolute(style)} }`);
        });
      });

      result.cssInfo = {
        totalStylesheets: styleSheets.length,
        totalInlineStyles: elementsWithStyle.length,
        blockedStylesheets,
        extractedCSS: allCSS.join('\n\n') + '\n\n/* Inline Styles */\n' + inlineStyles.join('\n'),
      };

      // Consolidate CSS in the document
      document.querySelectorAll('style:not([data-source])').forEach(style => {
        if (!style.hasAttribute('data-original')) {
          style.remove();
        }
      });

      if (result.cssInfo.extractedCSS) {
        const styleTag = document.createElement('style');
        styleTag.setAttribute('data-source', 'consolidated-css');
        styleTag.textContent = result.cssInfo.extractedCSS;
        document.head.insertBefore(styleTag, document.head.firstChild);
      }
    }

    // Extract HTML (always needed, done last after all modifications)
    result.html = document.documentElement.outerHTML;

    return result;
  }, { collectCssClasses, extractVisibility, extractImages, extractCss });

  // Calculate visibility percentage if extracted
  if (allData.visibilityInfo) {
    const totalVisible = allData.visibilityInfo.totalElements -
      allData.visibilityInfo.hiddenElements -
      allData.visibilityInfo.invisibleElements -
      allData.visibilityInfo.zeroOpacityElements;
    const visiblePercentage = allData.visibilityInfo.totalElements > 0
      ? (totalVisible / allData.visibilityInfo.totalElements) * 100
      : 0;
    allData.visibilityInfo.visiblePercentage = Math.round(visiblePercentage * 10) / 10;
  }

  return allData as PageData;
  } catch (error) {
    console.error(`Error fetching page data for ${url}:`, error);
    throw error;
  } finally {
    // Always close the page, even if there was an error
    await page.close().catch((err: any) => console.error('Error closing page:', err));
  }
}

