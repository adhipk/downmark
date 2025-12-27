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
  
  const reader = new Readability(document, { charThreshold: 100 });
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
  
  const remove = [
    "nav", "header", "footer", "aside", ".sidebar", ".ads", ".comments",
    ".related-posts", ".advertisement", "script", "style", "noscript",
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
  
  return document.body?.innerHTML || html;
}

