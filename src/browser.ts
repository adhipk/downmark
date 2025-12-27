/**
 * Headless browser utilities using Puppeteer with stealth
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { PageData } from "./types.ts";

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

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

export async function getPageData(url: string): Promise<PageData> {
  const userAgent = randomChoice(USER_AGENTS);
  const viewport = randomChoice(VIEWPORTS);
  
  const browser = await puppeteer.launch({
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
  
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height });
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders(HEADERS);
  
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
    referer: "https://www.google.com/",
  });
  
  // Wait for any JS challenges to complete
  await page.waitForFunction(() => {
    const title = document.title;
    return !title.includes("Just a moment") && !title.includes("Checking");
  }, { timeout: 30000 }).catch(() => {});
  
  const data = await page.evaluate(() => {
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
    
    const classSet = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      el.classList.forEach((cls) => classSet.add(cls));
    });
    
    return {
      html: document.documentElement.outerHTML,
      metadata,
      cssClasses: Array.from(classSet).sort(),
    };
  });
  
  await browser.close();
  return data;
}

