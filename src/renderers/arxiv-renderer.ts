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
   * Clean up the author section by reformatting it for better readability
   */
  private cleanupAuthors(content: Element): void {
    const authorsSection = content.querySelector(".ltx_authors");
    if (!authorsSection) return;

    // Find all author entries
    const authors = authorsSection.querySelectorAll(".ltx_author");

    if (authors.length === 0) return;

    // Build a cleaner author list
    const authorList: string[] = [];

    authors.forEach((author: Element) => {
      const personName = author.querySelector(".ltx_personname")?.textContent?.trim();
      const contact = author.querySelector(".ltx_contact")?.textContent?.trim();

      if (personName) {
        let authorStr = personName;
        if (contact && !contact.includes("@")) {
          // Add affiliation if it's not an email
          authorStr += ` (${contact})`;
        }
        authorList.push(authorStr);
      }
    });

    // Remove all footnote markers and references
    authorsSection.querySelectorAll("sup, .ltx_note, .ltx_role").forEach((el: Element) => {
      el.remove();
    });

    // Create a clean author display
    if (authorList.length > 0) {
      const cleanAuthorsHtml = `
        <div class="ltx_authors_clean">
          <div class="ltx_author_list">
            ${authorList.map(author => `<span class="ltx_author_name">${this.escape(author)}</span>`).join(' • ')}
          </div>
        </div>
      `;

      // Replace the messy authors section with our clean version
      const tempDiv = content.ownerDocument.createElement('div');
      tempDiv.innerHTML = cleanAuthorsHtml;
      authorsSection.replaceWith(tempDiv.firstElementChild as Element);
    }

    // Remove the contribution footnotes section if it exists
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
