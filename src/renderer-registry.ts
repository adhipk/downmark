import type { IRenderer } from "./renderer-interface.ts";
import { DefaultRenderer } from "./renderers/default-renderer.ts";
import { WikipediaRenderer } from "./renderers/wikipedia-renderer.ts";
import { AIRenderer } from "./renderers/ai-renderer.ts";
import { ArxivRenderer } from "./renderers/arxiv-renderer.ts";

/**
 * Domain pattern matching using minimatch-style patterns
 * Supports both hostname and path matching
 */
function matchesPattern(url: string, pattern: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    const fullPath = `${hostname}${pathname}`;

    // Wildcard pattern: * matches everything
    if (pattern === "*") return true;

    // Pattern includes path component (e.g., "arxiv.org/html/*")
    if (pattern.includes("/")) {
      const patternLower = pattern.toLowerCase();

      // Exact match with path
      if (fullPath === patternLower) return true;

      // Wildcard match at end (e.g., "arxiv.org/html/*")
      if (patternLower.endsWith("/*")) {
        const prefix = patternLower.slice(0, -2);
        return fullPath.startsWith(prefix);
      }

      return false;
    }

    // Hostname-only matching
    // Exact match
    if (hostname === pattern.toLowerCase()) return true;

    // Wildcard match: *.example.com
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1).toLowerCase(); // .example.com
      return hostname.endsWith(suffix);
    }

    // Wildcard match: example.*
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2).toLowerCase(); // example
      const hostPrefix = hostname.split(".")[0];
      return hostPrefix === prefix;
    }

    return false;
  } catch (e) {
    // Invalid URL, no match
    return false;
  }
}

/**
 * Registry for discovering and selecting renderers
 */
export class RendererRegistry {
  private renderers: IRenderer[] = [];
  private defaultRenderer: IRenderer;

  constructor() {
    this.defaultRenderer = new DefaultRenderer();
  }

  /**
   * Register a renderer
   */
  register(renderer: IRenderer): void {
    this.renderers.push(renderer);
    // Sort by priority (descending)
    this.renderers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Register all available renderers
   * Note: Renderers are imported directly rather than discovered dynamically
   * to support compiled executables
   */
  async discoverRenderers(): Promise<void> {
    // Register all custom renderers here
    const renderers = [
      new WikipediaRenderer(),
      new ArxivRenderer(),
      new AIRenderer(),
      // Add new renderers here as they are created
    ];

    for (const renderer of renderers) {
      if (this.isValidRenderer(renderer)) {
        this.register(renderer);
        console.log(`[RendererRegistry] Registered: ${renderer.name} (${renderer.patterns.join(", ")})`);
      } else {
        console.warn(`[RendererRegistry] Invalid renderer: ${renderer.constructor.name}`);
      }
    }
  }

  /**
   * Select the appropriate renderer for a URL
   */
  selectRenderer(url: string): IRenderer {
    for (const renderer of this.renderers) {
      for (const pattern of renderer.patterns) {
        if (matchesPattern(url, pattern)) {
          return renderer;
        }
      }
    }

    return this.defaultRenderer;
  }

  /**
   * Get all registered renderers
   */
  getAll(): IRenderer[] {
    return [...this.renderers, this.defaultRenderer];
  }

  private isValidRenderer(obj: any): obj is IRenderer {
    return (
      obj &&
      typeof obj.name === "string" &&
      typeof obj.description === "string" &&
      Array.isArray(obj.patterns) &&
      typeof obj.process === "function" &&
      typeof obj.format === "function"
    );
  }
}

// Singleton instance
export const rendererRegistry = new RendererRegistry();
