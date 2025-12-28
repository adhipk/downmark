import type { IRenderer, ProcessedContent, RendererResponse } from "../renderer-interface.ts";
import type { PageData } from "../types.ts";
import { removeBoilerplate, transformImagesToAbsolute, transformLinksToHtmx } from "../extractor.ts";

/**
 * Abstract base class providing default implementations
 * Renderers can extend this to inherit standard behavior
 */
export abstract class BaseRenderer implements IRenderer {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly patterns: string[];
  readonly priority: number = 0;

  /**
   * Default processing: use existing extraction logic
   */
  async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    let cleanHtml = removeBoilerplate(pageData.html);
    cleanHtml = transformImagesToAbsolute(cleanHtml, sourceUrl);
    cleanHtml = transformLinksToHtmx(cleanHtml, sourceUrl);

    return {
      html: cleanHtml,
      metadata: pageData.metadata,
      rendererName: this.name,
    };
  }

  /**
   * Default formatting: wrap content with metadata panel
   */
  async format(processed: ProcessedContent, sourceUrl: string): Promise<RendererResponse> {
    // Extract metadata for display
    const metadata = {
      title: processed.metadata.title || processed.metadata["og:title"] || "",
      description: processed.metadata.description || processed.metadata["og:description"] || "",
      author: processed.metadata.author || processed.metadata["article:author"] || "",
      siteName: processed.metadata["og:site_name"] || "",
      favicon: this.extractFavicon(processed.metadata),
      canonical: processed.metadata.canonical || sourceUrl,
    };

    // Generate metadata panel HTML
    const metadataPanel = this.generateMetadataPanel(metadata, processed.rendererName);

    // Prepend title as h1 to content if available and not already present
    let content = processed.html;
    if (metadata.title && !processed.html.includes('<h1')) {
      const titleHtml = `<h1 class="article-title">${this.escape(metadata.title)}</h1>`;
      content = titleHtml + content;
    }

    return {
      content,
      metadata,
      metadataPanel,
    };
  }

  protected extractFavicon(metadata: Record<string, any>): string | undefined {
    return metadata["og:image"] || undefined;
  }

  protected generateMetadataPanel(metadata: any, rendererName?: string): string {
    const items = [];

    // Don't show title in metadata panel - it's already shown as h1 in content

    if (metadata.description) {
      items.push(`<div class="metadata-item"><span class="label">Description:</span><span class="value">${this.escape(metadata.description)}</span></div>`);
    }

    if (metadata.author) {
      items.push(`<div class="metadata-item"><span class="label">Author:</span><span class="value">${this.escape(metadata.author)}</span></div>`);
    }

    if (metadata.siteName) {
      items.push(`<div class="metadata-item"><span class="label">Site:</span><span class="value">${this.escape(metadata.siteName)}</span></div>`);
    }

    if (rendererName) {
      items.push(`<div class="metadata-item"><span class="label">Renderer:</span><span class="value">${this.escape(rendererName)}</span></div>`);
    }

    if (items.length === 0) return "";

    return `
      <div id="metadata-panel" class="metadata-panel" hx-swap-oob="true">
        ${items.join("\n")}
      </div>
    `;
  }

  protected escape(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
