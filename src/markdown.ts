/**
 * Markdown conversion and frontmatter generation
 */

import { $ } from "bun";

export async function htmlToMarkdown(html: string): Promise<string> {
  const result = await $`echo ${html} | pandoc -f html -t gfm`.text();
  return result;
}

export function generateFrontmatter(
  metadata: Record<string, string | string[]>,
  cssClasses: string[],
  sourceUrl: string
): string {
  const lines = ["---"];
  
  lines.push(`source: "${sourceUrl}"`);
  lines.push(`fetched_at: "${new Date().toISOString()}"`);
  
  const priorityKeys = ["title", "description", "author", "og:title", "og:description", "og:image", "canonical", "lang"];
  const addedKeys = new Set<string>();
  
  for (const key of priorityKeys) {
    if (metadata[key]) {
      const safeKey = key.replace(/:/g, "_");
      const value = String(metadata[key]).replace(/"/g, '\\"');
      lines.push(`${safeKey}: "${value}"`);
      addedKeys.add(key);
    }
  }
  
  for (const [key, value] of Object.entries(metadata)) {
    if (!addedKeys.has(key)) {
      const safeKey = key.replace(/:/g, "_").replace(/\s+/g, "_");
      const safeValue = String(value).replace(/"/g, '\\"');
      lines.push(`${safeKey}: "${safeValue}"`);
    }
  }
  
  if (cssClasses.length > 0) {
    lines.push("css_classes:");
    for (const cls of cssClasses.slice(0, 50)) {
      lines.push(`  - "${cls}"`);
    }
    if (cssClasses.length > 50) {
      lines.push(`  # ... and ${cssClasses.length - 50} more`);
    }
  }
  
  lines.push("---");
  return lines.join("\n");
}

