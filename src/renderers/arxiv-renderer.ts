import { BaseRenderer } from "./base-renderer.ts";
import type { PageData } from "../types.ts";
import type { ProcessedContent } from "../renderer-interface.ts";
import { transformImagesToAbsolute, transformLinksToHtmx } from "../extractor.ts";
import { parseHTML } from "linkedom";

/**
 * arXiv-specific renderer
 * - Cleans up complex author metadata
 * - Removes footnote markers and simplifies author affiliations
 * - Preserves mathematical notation and figures
 */
export class ArxivRenderer extends BaseRenderer {
  readonly name = "arxiv";
  readonly description = "arXiv paper renderer with cleaned author metadata";
  readonly patterns = [
    "arxiv.org/html/*",
    "arxiv.org/abs/*",
  ];
  override readonly priority = 10; // Higher priority

  override async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    const { document } = parseHTML(pageData.html);

    // Get main content
    const content = document.querySelector("article.ltx_document");

    if (!content) {
      // Fallback to default behavior if not an arXiv HTML paper
      return super.process(pageData, sourceUrl);
    }

    // Clean up author section
    this.cleanupAuthors(content);

    // Convert footnotes and citations to clickable links
    this.convertFootnotesToLinks(content, sourceUrl);
    this.convertCitationsToLinks(content, sourceUrl);

    // Remove unnecessary elements
    const selectorsToRemove = [
      ".ltx_page_header", // Header
      ".ltx_page_footer", // Footer
      ".ltx_page_logo", // arXiv logo
      "script",
      "noscript",
    ];

    for (const selector of selectorsToRemove) {
      content.querySelectorAll(selector).forEach((el: Element) => el.remove());
    }

    // Extract title
    const titleEl = content.querySelector(".ltx_title");
    let titleHtml = "";
    if (titleEl) {
      const titleText = titleEl.textContent?.trim() || "";
      pageData.metadata.title = titleText;
      titleHtml = `<h1 class="article-title">${this.escape(titleText)}</h1>`;
    }

    // Extract abstract
    const abstractEl = content.querySelector(".ltx_abstract");
    if (abstractEl) {
      const abstractText = abstractEl.textContent?.trim() || "";
      if (abstractText) {
        pageData.metadata.description = abstractText.slice(0, 500);
      }
    }

    let cleanHtml = content.innerHTML;

    // Apply standard transformations
    cleanHtml = transformImagesToAbsolute(cleanHtml, sourceUrl);
    cleanHtml = transformLinksToHtmx(cleanHtml, sourceUrl);

    return {
      html: cleanHtml,
      metadata: {
        ...pageData.metadata,
        siteName: "arXiv",
        rendererVersion: "1.0.0",
      },
      rendererName: this.name,
      processingNotes: [
        "Cleaned up author metadata",
        "Preserved mathematical notation",
        "Optimized for readability",
      ],
    };
  }

  /**
   * Clean up the author section by removing clutter while keeping names
   */
  private cleanupAuthors(content: Element): void {
    const authorsSection = content.querySelector(".ltx_authors");
    if (!authorsSection) return;

    // Remove all footnote markers and notes from author section
    authorsSection.querySelectorAll("sup.ltx_note_mark, .ltx_note_outer, .ltx_note").forEach((el: Element) => {
      el.remove();
    });

    // Remove email addresses (in typewriter font)
    authorsSection.querySelectorAll(".ltx_text.ltx_font_typewriter").forEach((el: Element) => {
      el.remove();
    });

    // Remove br tags for cleaner layout
    authorsSection.querySelectorAll("br").forEach((el: Element) => {
      // Replace with space
      const textNode = content.ownerDocument.createTextNode(" ");
      el.parentNode?.replaceChild(textNode, el);
    });

    // Remove the author notes section
    authorsSection.querySelectorAll(".ltx_author_notes").forEach((el: Element) => {
      el.remove();
    });

    // Clean up extra whitespace
    const authorText = authorsSection.textContent || "";
    const cleanedText = authorText
      .replace(/\s+/g, " ")  // Multiple spaces to single space
      .replace(/\s*&\s*/g, " • ")  // & to bullet
      .trim();

    // Replace entire section with cleaned text
    authorsSection.innerHTML = `<div class="ltx_authors_clean">${this.escape(cleanedText)}</div>`;

    // Remove the contribution footnotes section throughout the document
    const footnotes = content.querySelectorAll(".ltx_note_outer");
    footnotes.forEach((note: Element) => {
      const noteContent = note.textContent || "";
      // Remove if it's about equal contribution or authorship details
      if (noteContent.includes("Equal contribution") ||
          noteContent.includes("Work performed while") ||
          noteContent.includes("Listing order is random")) {
        note.remove();
      }
    });
  }

  /**
   * Convert footnote markers to clickable links that scroll to the footnote
   */
  private convertFootnotesToLinks(content: Element, sourceUrl: string): void {
    // Find all footnote markers (superscripts with footnote class)
    const footnoteMarkers = content.querySelectorAll("sup.ltx_note_mark");

    footnoteMarkers.forEach((marker: Element) => {
      const footnoteId = marker.parentElement?.getAttribute("id");
      if (!footnoteId) return;

      // Find the corresponding footnote content
      const footnoteContent = content.querySelector(`#${footnoteId} .ltx_note_content`);
      if (!footnoteContent) return;

      // Get the footnote text
      const footnoteText = footnoteContent.textContent?.trim() || "";

      // Create a link that will navigate within the page
      // Use onclick to scroll instead of href to avoid HTMX processing
      const markText = marker.textContent || "";
      const linkHtml = `<a href="javascript:void(0)" onclick="document.getElementById('footnote-${footnoteId}')?.scrollIntoView({behavior:'smooth'})" class="footnote-link" title="${this.escape(footnoteText)}">${this.escape(markText)}</a>`;

      marker.innerHTML = linkHtml;
    });

    // Add IDs to footnote content sections so links can target them
    const footnoteContents = content.querySelectorAll(".ltx_note_content");
    footnoteContents.forEach((footnote: Element) => {
      const parent = footnote.parentElement;
      if (parent) {
        const parentId = parent.getAttribute("id");
        if (parentId) {
          footnote.setAttribute("id", `footnote-${parentId}`);
        }
      }
    });
  }

  /**
   * Convert citation references to clickable links
   */
  private convertCitationsToLinks(content: Element, sourceUrl: string): void {
    // Find all citation links
    const citations = content.querySelectorAll(".ltx_cite a.ltx_ref");

    citations.forEach((citation: Element) => {
      const href = citation.getAttribute("href");
      if (!href) return;

      // If it's a relative link, convert it to point to the full URL
      if (href.startsWith("#")) {
        const targetId = href.slice(1);
        const target = content.querySelector(`#${targetId}`);

        if (target) {
          // Add a title with the citation text for hover
          const citationText = target.textContent?.trim() || "";
          if (citationText) {
            citation.setAttribute("title", citationText.slice(0, 200));
          }
        }
      }
    });
  }

  protected override generateMetadataPanel(metadata: any, rendererName?: string): string {
    const panel = super.generateMetadataPanel(metadata, rendererName);

    // Add arXiv-specific styling hint
    if (panel) {
      return panel.replace(
        'class="metadata-panel"',
        'class="metadata-panel arxiv-paper"'
      );
    }

    return panel;
  }
}
