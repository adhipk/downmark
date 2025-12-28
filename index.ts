#!/usr/bin/env bun

import { getUrl } from "./src/cli.ts";
import { getPageData, closeBrowser } from "./src/browser.ts";
import { extractContent, removeBoilerplate } from "./src/extractor.ts";
import { htmlToMarkdown, generateFrontmatter } from "./src/markdown.ts";

const url = await getUrl();
const { html, metadata, cssClasses } = await getPageData(url);

// Extract main content using Readability
const extracted = extractContent(html, url);

let cleanHtml: string;
let title = metadata.title as string || "";

if (extracted) {
  cleanHtml = extracted.content;
  title = extracted.title || title;
  if (extracted.byline) metadata.author = extracted.byline;
  if (extracted.siteName) metadata.site_name = extracted.siteName;
  if (extracted.excerpt) metadata.excerpt = extracted.excerpt;
  if (extracted.lang) metadata.lang = extracted.lang;
} else {
  cleanHtml = removeBoilerplate(html);
}

const markdown = await htmlToMarkdown(cleanHtml);
const frontmatter = generateFrontmatter(metadata, cssClasses, url);

console.log(frontmatter);
console.log("");
console.log(markdown);

// Graceful cleanup
await closeBrowser();
