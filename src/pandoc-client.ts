/**
 * Client for the Pandoc microservice
 */

const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || "http://localhost:3001";

export interface ConversionOptions {
  html: string;
  from?: string;
  to?: string;
  extraArgs?: string[];
}

export interface ConversionResult {
  success: boolean;
  markdown?: string;
  error?: string;
  length?: number;
}

/**
 * Convert HTML to Markdown using the pandoc service
 */
export async function convertHtmlToMarkdown(
  html: string,
  options: Omit<ConversionOptions, "html"> = {}
): Promise<string> {
  try {
    const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        from: options.from || "html",
        to: options.to || "markdown",
        extraArgs: options.extraArgs || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result: ConversionResult = await response.json();

    if (!result.success || !result.markdown) {
      throw new Error(result.error || "Conversion failed");
    }

    return result.markdown;
  } catch (error: any) {
    console.error("[PandocClient] Conversion error:", error);
    throw new Error(`Pandoc conversion failed: ${error.message}`);
  }
}

/**
 * Batch convert multiple HTML strings to Markdown
 */
export async function convertBatch(
  conversions: ConversionOptions[]
): Promise<ConversionResult[]> {
  try {
    const response = await fetch(`${PANDOC_SERVICE_URL}/convert/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversions }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.results;
  } catch (error: any) {
    console.error("[PandocClient] Batch conversion error:", error);
    throw error;
  }
}

/**
 * Check if pandoc service is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    console.log(`[PandocClient] Checking health at ${PANDOC_SERVICE_URL}/health`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${PANDOC_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const result = await response.json();
    console.log(`[PandocClient] Health check result:`, result);
    return result.status === "healthy";
  } catch (error: any) {
    console.error(`[PandocClient] Health check failed:`, error.message);
    return false;
  }
}
