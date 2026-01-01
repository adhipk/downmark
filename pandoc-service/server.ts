/**
 * Pandoc Microservice
 * Lightweight service for converting HTML to Markdown using Pandoc
 */

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Health check endpoint
async function healthCheck() {
  try {
    // Check if pandoc is available
    const proc = Bun.spawn(["pandoc", "--version"]);
    await proc.exited;
    return { status: "healthy", pandocAvailable: true };
  } catch (error: any) {
    return { status: "unhealthy", error: error.message };
  }
}

// Convert HTML to Markdown using pandoc
async function convertHtmlToMarkdown(html: string, options: {
  from?: string;
  to?: string;
  extraArgs?: string[];
} = {}): Promise<string> {
  const {
    from = "html",
    to = "markdown",
    extraArgs = [],
  } = options;

  // Build pandoc command
  const args = [
    "--from", from,
    "--to", to,
    "--wrap=none",
    "--no-highlight",
    ...extraArgs,
  ];

  try {
    // Spawn pandoc process with HTML as stdin
    const proc = Bun.spawn(["pandoc", ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Write HTML to stdin
    proc.stdin.write(html);
    proc.stdin.end();

    // Wait for completion
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Pandoc conversion failed: ${stderr}`);
    }

    // Get markdown output
    const markdown = await new Response(proc.stdout).text();
    return markdown;
  } catch (error: any) {
    console.error("Pandoc conversion error:", error);
    throw error;
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === "/health") {
      const health = await healthCheck();
      return Response.json(health);
    }

    // Convert endpoint
    if (pathname === "/convert" && req.method === "POST") {
      try {
        const body = await req.json();
        const { html, from, to, extraArgs } = body;

        if (!html) {
          return Response.json(
            { error: "Missing 'html' in request body" },
            { status: 400 }
          );
        }

        const markdown = await convertHtmlToMarkdown(html, {
          from,
          to,
          extraArgs,
        });

        return Response.json({
          success: true,
          markdown,
          length: markdown.length,
        });
      } catch (error: any) {
        console.error("Conversion error:", error);
        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    // Batch convert endpoint (for multiple conversions)
    if (pathname === "/convert/batch" && req.method === "POST") {
      try {
        const body = await req.json();
        const { conversions } = body;

        if (!Array.isArray(conversions)) {
          return Response.json(
            { error: "'conversions' must be an array" },
            { status: 400 }
          );
        }

        const results = await Promise.all(
          conversions.map(async (conv: any) => {
            try {
              const markdown = await convertHtmlToMarkdown(conv.html, {
                from: conv.from,
                to: conv.to,
                extraArgs: conv.extraArgs,
              });
              return { success: true, markdown };
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          })
        );

        return Response.json({
          success: true,
          results,
        });
      } catch (error: any) {
        console.error("Batch conversion error:", error);
        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  },
});

console.log(`Pandoc service running at http://${HOST}:${server.port}`);
console.log(`Health check: http://${HOST}:${server.port}/health`);
