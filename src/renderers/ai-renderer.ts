import { BaseRenderer } from "./base-renderer.ts";
import type { PageData } from "../types.ts";
import type { ProcessedContent } from "../renderer-interface.ts";
import { removeBoilerplate, transformImagesToAbsolute, transformLinksToHtmx } from "../extractor.ts";
import { htmlToMarkdown } from "../markdown.ts";
import { marked } from "marked";

/**
 * AI-powered renderer that uses an LLM to refine extracted content
 * Processes content through Pandoc first, then uses AI to clean and improve it
 */
export class AIRenderer extends BaseRenderer {
  readonly name = "ai";
  readonly description = "AI-powered renderer that uses LLM to refine and improve extracted content";
  readonly patterns: string[] = []; // No automatic pattern matching - must be explicitly enabled
  readonly priority = 100; // Highest priority when enabled

  private apiKey: string | undefined;
  private apiEndpoint: string;
  private model: string;
  private enabled: boolean;

  constructor() {
    super();
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    this.apiEndpoint = process.env.AI_RENDERER_ENDPOINT || "https://api.anthropic.com/v1/messages";
    this.model = process.env.AI_RENDERER_MODEL || "claude-3-5-haiku-20241022";
    this.enabled = process.env.AI_RENDERER_ENABLED === "true" && !!this.apiKey;

    if (!this.enabled && process.env.AI_RENDERER_ENABLED === "true") {
      console.warn("[AIRenderer] AI renderer enabled but no API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
    }
  }

  async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    // First, use standard extraction
    let cleanHtml = removeBoilerplate(pageData.html);
    cleanHtml = transformImagesToAbsolute(cleanHtml, sourceUrl);

    // Convert to markdown using Pandoc
    const markdown = await htmlToMarkdown(cleanHtml);

    // If AI is not enabled or no API key, just return the Pandoc output
    if (!this.enabled || !this.apiKey) {
      const htmlFromMarkdown = await marked.parse(markdown);
      const finalHtml = transformLinksToHtmx(htmlFromMarkdown, sourceUrl);

      return {
        html: finalHtml,
        metadata: pageData.metadata,
        rendererName: this.name,
        processingNotes: ["AI rendering disabled - using Pandoc output only"],
      };
    }

    try {
      // Use AI to refine the markdown
      console.log(`[AIRenderer] Starting AI refinement for ${sourceUrl} (${markdown.length} chars)`);
      const startTime = Date.now();

      const refinedMarkdown = await this.refineWithAI(markdown, pageData.metadata, sourceUrl);

      const duration = Date.now() - startTime;
      console.log(`[AIRenderer] AI refinement completed in ${duration}ms`);

      // Convert back to HTML
      const htmlFromMarkdown = await marked.parse(refinedMarkdown);
      const finalHtml = transformLinksToHtmx(htmlFromMarkdown, sourceUrl);

      return {
        html: finalHtml,
        metadata: pageData.metadata,
        rendererName: this.name,
        processingNotes: [`Content refined using AI (${duration}ms)`],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[AIRenderer] Error refining with AI:", errorMsg);

      // Fallback to non-AI version
      const htmlFromMarkdown = await marked.parse(markdown);
      const finalHtml = transformLinksToHtmx(htmlFromMarkdown, sourceUrl);

      return {
        html: finalHtml,
        metadata: pageData.metadata,
        rendererName: this.name,
        processingNotes: [`AI refinement failed: ${errorMsg} - using Pandoc output`],
      };
    }
  }

  private async refineWithAI(markdown: string, metadata: Record<string, any>, sourceUrl: string): Promise<string> {
    const prompt = this.buildPrompt(markdown, metadata, sourceUrl);

    // Detect if using Anthropic or OpenAI
    const isAnthropic = this.apiEndpoint.includes("anthropic");

    // Add timeout wrapper (configurable, default 30 seconds)
    const timeoutMs = parseInt(process.env.AI_RENDERER_TIMEOUT || "30000", 10);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`AI API request timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const apiPromise = isAnthropic
      ? this.callAnthropicAPI(prompt)
      : this.callOpenAIAPI(prompt);

    return await Promise.race([apiPromise, timeoutPromise]);
  }

  private buildPrompt(markdown: string, metadata: Record<string, any>, sourceUrl: string): string {
    const title = metadata.title || "Unknown";
    const description = metadata.description || "";

    return `You are a content refinement assistant. You receive markdown content that has been extracted from a webpage using Pandoc, and your job is to clean it up and make it more readable.

Source URL: ${sourceUrl}
Title: ${title}
Description: ${description}

Your tasks:
1. Remove any remaining boilerplate, navigation elements, footers, or promotional content
2. Fix any formatting issues or broken markdown syntax
3. Improve heading hierarchy if needed (ensure proper H1, H2, H3 structure)
4. Remove duplicate content
5. Fix broken links or references if possible
6. Preserve all important content, images, code blocks, and links
7. Keep the markdown clean and well-structured
8. DO NOT add any commentary, notes, or explanations - just output the refined markdown

Here's the markdown to refine:

${markdown}

Output only the refined markdown, nothing else.`;
  }

  private async callAnthropicAPI(prompt: string): Promise<string> {
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private async callOpenAIAPI(prompt: string): Promise<string> {
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a content refinement assistant. Output only the refined markdown, nothing else.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Check if AI rendering is available
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
