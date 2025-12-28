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

export async function getPageData(url: string, options: { collectCssClasses?: boolean } = {}): Promise<PageData> {
  const { collectCssClasses = false } = options;
  const userAgent = randomChoice(USER_AGENTS);
  const viewport = randomChoice(VIEWPORTS);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders(HEADERS);

    const waitStrategy = (process.env.BROWSER_WAIT_STRATEGY || "domcontentloaded") as "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    const browserTimeout = parseInt(process.env.BROWSER_TIMEOUT || "30000", 10);
    const waitTimeout = parseInt(process.env.BROWSER_WAIT_TIMEOUT || "10000", 10);
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
  
  // Detect hidden/invisible elements using computed styles
  const visibilityData = await page.evaluate(() => {
    let hiddenElements = 0;
    let invisibleElements = 0;
    let offscreenElements = 0;
    let zeroOpacityElements = 0;

    const allElements = document.querySelectorAll('*');

    allElements.forEach((el: HTMLElement) => {
      const computed = window.getComputedStyle(el);

      // Check display:none
      if (computed.display === 'none') {
        el.setAttribute('data-display-none', 'true');
        hiddenElements++;
        return;
      }

      // Check visibility:hidden
      if (computed.visibility === 'hidden') {
        el.setAttribute('data-visibility-hidden', 'true');
        invisibleElements++;
        return;
      }

      // Check opacity:0
      if (computed.opacity === '0') {
        el.setAttribute('data-opacity-zero', 'true');
        zeroOpacityElements++;
        return;
      }

      // Check if positioned off-screen
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        // Might be off-screen or collapsed
        offscreenElements++;
      }
    });

    return {
      totalElements: allElements.length,
      hiddenElements,
      invisibleElements,
      zeroOpacityElements,
      offscreenElements,
    };
  });

  // Extract computed dimensions for all images and collect stats
  const imageData = await page.evaluate(() => {
    let imagesAdded = 0;
    let svgsAdded = 0;
    let imagesWithDimensions = 0;
    let svgsWithDimensions = 0;

    // Give images time to load and render
    const images = document.querySelectorAll('img');
    images.forEach((img: HTMLImageElement) => {
      const hadDimensions = img.hasAttribute('width') || img.hasAttribute('height');

      // Capture original display type from computed styles
      const computed = window.getComputedStyle(img);
      if (computed.display && !img.hasAttribute('data-original-display')) {
        img.setAttribute('data-original-display', computed.display);
      }

      // Only add dimensions if not already specified
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

      // Add loading="lazy" for better performance if not specified
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      // Add alt text if missing (for accessibility)
      if (!img.hasAttribute('alt')) {
        img.setAttribute('alt', '');
      }
    });

    // Handle SVG dimensions
    const svgs = document.querySelectorAll('svg');
    svgs.forEach((svg: SVGSVGElement) => {
      const hadDimensions = svg.hasAttribute('width') || svg.hasAttribute('height');

      try {
        const bbox = svg.getBBox?.();
        if (bbox && !svg.hasAttribute('width') && !svg.hasAttribute('height')) {
          svg.setAttribute('width', Math.ceil(bbox.width).toString());
          svg.setAttribute('height', Math.ceil(bbox.height).toString());
          svgsAdded++;
        }
      } catch (e) {
        // getBBox can fail for some SVGs
      }

      if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
        svgsWithDimensions++;
      }

      // If no viewBox, add one based on dimensions
      if (!svg.hasAttribute('viewBox')) {
        const width = svg.getAttribute('width');
        const height = svg.getAttribute('height');
        if (width && height) {
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
      }
    });

    return {
      totalImages: images.length,
      totalSVGs: svgs.length,
      imagesWithDimensions,
      imagesAdded,
      svgsWithDimensions,
      svgsAdded,
    };
  });

  // Extract and consolidate ALL CSS from the page
  const cssData = await page.evaluate(() => {
    const allCSS: string[] = [];
    const inlineStyles: string[] = [];
    let blockedStylesheets = 0;

    // Extract from all stylesheets (external and inline)
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach((sheet) => {
      try {
        // Check if we can access cssRules (CORS check)
        if (sheet.cssRules) {
          const cssText = Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
          if (cssText) {
            allCSS.push(cssText);
          }
        }
      } catch (e) {
        // CORS or OpaqueResponseBlocking - stylesheet is from different origin
        // We can't access the rules, but we can keep the link tag
        blockedStylesheets++;

        // Try to at least note which stylesheet was blocked
        if (sheet.href) {
          allCSS.push(`/* External stylesheet blocked by CORS: ${sheet.href} */`);
        }
      }
    });

    // Extract inline styles from elements
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

    // Convert inline styles to CSS rules
    styleMap.forEach((styles, selector) => {
      // Deduplicate and merge styles
      const uniqueStyles = Array.from(new Set(styles));
      uniqueStyles.forEach(style => {
        inlineStyles.push(`${selector} { ${style} }`);
      });
    });

    return {
      allCSS: allCSS.join('\n\n'),
      inlineStyles: inlineStyles.join('\n'),
      totalStylesheets: styleSheets.length,
      totalInlineStyles: elementsWithStyle.length,
      blockedStylesheets,
    };
  });

  // Create a consolidated style tag in the document
  await page.evaluate((css) => {
    // Remove only inline style tags we can control, keep external links
    document.querySelectorAll('style:not([data-source])').forEach(style => {
      // Only remove if it's not from an external source
      if (!style.hasAttribute('data-original')) {
        style.remove();
      }
    });

    // Add consolidated CSS only if we have any
    if (css.allCSS || css.inlineStyles) {
      const styleTag = document.createElement('style');
      styleTag.setAttribute('data-source', 'consolidated-css');
      styleTag.textContent = css.allCSS + '\n\n/* Inline Styles */\n' + css.inlineStyles;
      document.head.insertBefore(styleTag, document.head.firstChild);
    }
  }, cssData);

  const data = await page.evaluate((shouldCollectCssClasses: boolean) => {
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

    let cssClasses: string[] = [];
    if (shouldCollectCssClasses) {
      const classSet = new Set<string>();
      document.querySelectorAll("*").forEach((el) => {
        el.classList.forEach((cls) => classSet.add(cls));
      });
      cssClasses = Array.from(classSet).sort();
    }

    return {
      html: document.documentElement.outerHTML,
      metadata,
      cssClasses,
    };
  }, collectCssClasses);

    // Calculate visibility percentage
    const totalVisible = visibilityData.totalElements -
      visibilityData.hiddenElements -
      visibilityData.invisibleElements -
      visibilityData.zeroOpacityElements;
    const visiblePercentage = visibilityData.totalElements > 0
      ? (totalVisible / visibilityData.totalElements) * 100
      : 0;

    // Add CSS, image, and visibility info to the result
    return {
      ...data,
      cssInfo: {
        totalStylesheets: cssData.totalStylesheets,
        totalInlineStyles: cssData.totalInlineStyles,
        blockedStylesheets: cssData.blockedStylesheets,
        extractedCSS: cssData.allCSS + '\n\n/* Inline Styles */\n' + cssData.inlineStyles,
      },
      imageInfo: imageData,
      visibilityInfo: {
        ...visibilityData,
        visiblePercentage: Math.round(visiblePercentage * 10) / 10,
      },
    };
  } catch (error) {
    console.error(`Error fetching page data for ${url}:`, error);
    throw error;
  } finally {
    // Always close the page, even if there was an error
    await page.close().catch(err => console.error('Error closing page:', err));
  }
}

