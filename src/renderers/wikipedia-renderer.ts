import { BaseRenderer } from "./base-renderer.ts";
import type { PageData } from "../types.ts";
import type { ProcessedContent } from "../renderer-interface.ts";
import { transformImagesToAbsolute, transformLinksToHtmx } from "../extractor.ts";
import { parseHTML } from "linkedom";

/**
 * Wikipedia-specific renderer
 * - Extracts main article content
 * - Removes edit links, citation needed tags, references
 * - Preserves infoboxes and tables
 * - Cleans up navigation elements
 * - Fixes citation IDs that break CSS selectors
 */
export class WikipediaRenderer extends BaseRenderer {
  readonly name = "wikipedia";
  readonly description = "Wikipedia article renderer with enhanced content extraction";
  readonly patterns = [
    "*.wikipedia.org",
    "wikipedia.org",
  ];
  override readonly priority = 10; // Higher priority

  override async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    const { document } = parseHTML(pageData.html);

    // Wikipedia-specific selectors
    const content = document.querySelector("#mw-content-text .mw-parser-output");

    if (!content) {
      // Fallback to default behavior
      return super.process(pageData, sourceUrl);
    }

    // Remove Wikipedia-specific clutter
    const selectorsToRemove = [
      ".mw-editsection", // Edit links
      ".mw-jump-link", // Jump links
      ".navbox", // Navigation boxes (bottom of article)
      ".vertical-navbox",
      ".sistersitebox",
      "#toc", // Table of contents
      ".mw-references-wrap", // References section
      "#References",
      "#External_links",
      "#See_also",
      ".hatnote", // Disambiguation notes
      ".ambox", // Article message boxes
      "style", // Remove inline styles
      "script",
      "noscript",
    ];

    for (const selector of selectorsToRemove) {
      content.querySelectorAll(selector).forEach((el: Element) => el.remove());
    }

    // Clean up citation needed tags - replace with text only
    content.querySelectorAll(".citation-needed").forEach((el: Element) => {
      el.replaceWith(el.textContent || "");
    });

    // Remove all citation superscripts (sup.reference) to avoid selector issues
    // These contain IDs with special characters that break htmx selectors
    content.querySelectorAll("sup.reference").forEach((el: Element) => {
      el.remove();
    });

    // Also remove any remaining sup elements with problematic IDs
    content.querySelectorAll("sup[id]").forEach((el: Element) => {
      const id = el.getAttribute("id");
      // If ID contains quotes or special chars that could break selectors, remove the element
      if (id && (id.includes("'") || id.includes('"') || id.includes("FOOTNOTE"))) {
        el.remove();
      }
    });

    // Keep infobox but clean it up
    const infobox = content.querySelector(".infobox");
    if (infobox) {
      // Remove edit links from infobox
      infobox.querySelectorAll(".mw-editsection").forEach((el: Element) => el.remove());
    }

    // Extract article title from Wikipedia's h1
    const wikiTitle = document.querySelector("#firstHeading");
    let titleHtml = "";
    if (wikiTitle) {
      const titleText = (wikiTitle.textContent || pageData.metadata.title || "") as string;
      pageData.metadata.title = titleText ?? "";
      titleHtml = `<h1 class="article-title">${this.escape(titleText)}</h1>`;
    }

    // Get first paragraph as excerpt (skip empty paragraphs)
    const paragraphs = content.querySelectorAll("p");
    for (const para of paragraphs) {
      const text = para.textContent?.trim();
      if (text && text.length > 50) {
        pageData.metadata.excerpt = text.slice(0, 300);
        break;
      }
    }

    let cleanHtml = titleHtml + content.innerHTML;

    // Apply standard transformations
    cleanHtml = transformImagesToAbsolute(cleanHtml, sourceUrl);
    cleanHtml = transformLinksToHtmx(cleanHtml, sourceUrl);

    return {
      html: cleanHtml,
      metadata: {
        ...pageData.metadata,
        siteName: "Wikipedia",
        rendererVersion: "1.0.0",
      },
      rendererName: this.name,
      processingNotes: [
        "Extracted main article content",
        "Removed edit links and citations",
        "Preserved infobox and tables",
      ],
    };
  }

  protected override generateMetadataPanel(metadata: any, rendererName?: string): string {
    let panel = super.generateMetadataPanel(metadata, rendererName);

    // Add Wikipedia-specific metadata - excerpt
    if (metadata.excerpt && panel) {
      const excerptHtml = `
        <div class="metadata-item metadata-excerpt">
          <span class="label">Excerpt:</span>
          <span class="value">${this.escape(metadata.excerpt)}</span>
        </div>
      `;

      // Insert excerpt after the opening div
      panel = panel.replace(
        '<div id="metadata-panel" class="metadata-panel" hx-swap-oob="true">',
        '<div id="metadata-panel" class="metadata-panel" hx-swap-oob="true">' + excerptHtml
      );
    }

    return panel;
  }
}
