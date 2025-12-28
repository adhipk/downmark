import { BaseRenderer } from "./base-renderer.ts";
import type { PageData } from "../types.ts";
import type { ProcessedContent } from "../renderer-interface.ts";
import { removeBoilerplate, transformImagesToAbsolute, transformLinksToHtmx } from "../extractor.ts";

/**
 * Default renderer using existing extraction logic
 * Matches all URLs (wildcard pattern)
 */
export class DefaultRenderer extends BaseRenderer {
  readonly name = "default";
  readonly description = "Default renderer using boilerplate removal and standard transformations";
  readonly patterns = ["*"]; // Matches everything
  readonly priority = -1; // Lowest priority (fallback)

  async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    // Use existing logic
    let cleanHtml = removeBoilerplate(pageData.html);
    cleanHtml = transformImagesToAbsolute(cleanHtml, sourceUrl);
    cleanHtml = transformLinksToHtmx(cleanHtml, sourceUrl);

    return {
      html: cleanHtml,
      metadata: pageData.metadata,
      rendererName: this.name,
    };
  }
}
