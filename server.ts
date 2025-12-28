import { getPageData, closeBrowser } from "./src/browser.ts";
import { extractContent, removeBoilerplate, transformLinksToHtmx, extractAllLinks, transformImagesToAbsolute } from "./src/extractor.ts";
import { htmlToMarkdown } from "./src/markdown.ts";
import { marked } from "marked";
import indexFile from "./index.html";
import * as auth from "./src/auth.ts";
import { rendererRegistry } from "./src/renderer-registry.ts";

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await closeBrowser();
  process.exit(0);
});

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

// Auth helpers
function getSessionFromRequest(req: Request): string | undefined {
  const cookie = req.headers.get('cookie');
  if (!cookie) return undefined;

  const sessionMatch = cookie.match(/session=([^;]+)/);
  return sessionMatch?.[1];
}

function isAuthenticated(req: Request): boolean {
  const sessionId = getSessionFromRequest(req);
  if (!sessionId) return false;

  const session = auth.getSession(sessionId);
  return !!session;
}

function requireAuth(req: Request): Response | null {
  if (!isAuthenticated(req)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return null;
}

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

const isDev = process.env.NODE_ENV !== 'production';

// Initialize renderer registry
console.log("[Server] Discovering renderers...");
await rendererRegistry.discoverRenderers();
console.log("[Server] Renderer discovery complete.");

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  development: isDev ? {
    hmr: true,
    console: true,
  } : undefined,
  routes: {
    "/": indexFile,
    "/config": {
      GET: () => {
        return jsonResponse({
          authEnabled: AUTH_ENABLED,
          rpId: process.env.RP_ID || 'localhost',
        });
      },
    },
    "/auth/register/start": {
      POST: async (req) => {
        try {
          const body = await req.json();
          const { username } = body;

          if (!username || typeof username !== 'string') {
            return jsonResponse({ error: 'Username required' }, 400);
          }

          const options = await auth.startRegistration(username);
          return jsonResponse(options);
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/auth/register/finish": {
      POST: async (req) => {
        try {
          const body = await req.json();
          const { username, response } = body;

          if (!username || !response) {
            return jsonResponse({ error: 'Username and response required' }, 400);
          }

          const user = await auth.finishRegistration(username, response);
          const sessionId = auth.createSession(user.id);

          return new Response(JSON.stringify({ success: true, username: user.username }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `session=${sessionId}; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`,
            },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/auth/login/start": {
      POST: async (req) => {
        try {
          const body = await req.json();
          const { username } = body;

          if (!username || typeof username !== 'string') {
            return jsonResponse({ error: 'Username required' }, 400);
          }

          const options = await auth.startAuthentication(username);
          return jsonResponse(options);
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/auth/login/finish": {
      POST: async (req) => {
        try {
          const body = await req.json();
          const { username, response } = body;

          if (!username || !response) {
            return jsonResponse({ error: 'Username and response required' }, 400);
          }

          const user = await auth.finishAuthentication(username, response);
          const sessionId = auth.createSession(user.id);

          return new Response(JSON.stringify({ success: true, username: user.username }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `session=${sessionId}; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`,
            },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/auth/logout": {
      POST: (req) => {
        const sessionId = getSessionFromRequest(req);
        if (sessionId) {
          auth.deleteSession(sessionId);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/',
          },
        });
      },
    },
    "/auth/status": {
      GET: (req) => {
        const authenticated = isAuthenticated(req);
        let username = null;

        if (authenticated) {
          const sessionId = getSessionFromRequest(req);
          const session = sessionId ? auth.getSession(sessionId) : null;
          const user = session ? auth.getUserById(session.userId) : null;
          username = user?.username || null;
        }

        return jsonResponse({ authenticated, username });
      },
    },
    "/render": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Stage 1: Fetch page data
          const pageData = await getPageData(targetUrl);

          // Stage 2: Select and execute renderer
          const renderer = rendererRegistry.selectRenderer(targetUrl);
          console.log(`[Render] Using renderer: ${renderer.name} for ${targetUrl}`);

          const processed = await renderer.process(pageData, targetUrl);
          const response = await renderer.format(processed, targetUrl);

          // Stage 3: Build final response
          let responseHtml = response.content;

          // Add metadata panel if available
          if (response.metadataPanel) {
            responseHtml = response.metadataPanel + "\n" + responseHtml;
          }

          // Add out-of-band swap to update the URL input field
          responseHtml += `
            <input type="text" name="q" id="urlInput" value="${targetUrl.replace(/"/g, '&quot;')}"
                   placeholder="Enter URL..."
                   hx-swap-oob="true" />
          `;

          return new Response(responseHtml, {
            headers: { "Content-Type": "text/html" },
          });
        } catch (error: any) {
          console.error(`Error rendering ${targetUrl}:`, error);
          const errorHtml = `
            <div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px; color: #c00;">
              <h3 style="margin-top: 0;">Error Loading Page</h3>
              <p><strong>URL:</strong> ${targetUrl}</p>
              <p><strong>Error:</strong> ${error.message}</p>
              <p style="font-size: 0.9em; color: #666;">This could be due to timeout, network issues, or the site blocking automated access. Try increasing BROWSER_TIMEOUT in .env or use a different URL.</p>
            </div>
          `;
          return new Response(errorHtml, {
            status: 200, // Return 200 so htmx displays the error
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },
    "/original": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data
          let { html } = await getPageData(targetUrl);

          // Transform images to absolute URLs
          html = transformImagesToAbsolute(html, targetUrl);

          // Transform links to use htmx for in-app navigation
          html = transformLinksToHtmx(html, targetUrl);

          // Add out-of-band swap to update the URL input field
          const responseHtml = `
            ${html}
            <input type="text" name="q" id="urlInput" value="${targetUrl.replace(/"/g, '&quot;')}"
                   placeholder="Enter URL (e.g., https://example.com)"
                   hx-swap-oob="true" />
          `;

          return new Response(responseHtml, {
            headers: { "Content-Type": "text/html" },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/links": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");
        const format = url.searchParams.get("format") || "json"; // json, text, or queryparams

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try{
          // Fetch page data
          const { html } = await getPageData(targetUrl);

          // Extract all links
          const links = extractAllLinks(html, targetUrl);

          // Return different formats based on query param
          if (format === "text") {
            // Plain text, one URL per line
            const textOutput = links.map(link => link.url).join('\n');
            return new Response(textOutput, {
              headers: { "Content-Type": "text/plain" },
            });
          } else if (format === "queryparams") {
            // Query params format: ?url=...&url=...
            const queryString = links.map(link => `url=${encodeURIComponent(link.url)}`).join('&');
            return new Response(queryString, {
              headers: { "Content-Type": "text/plain" },
            });
          } else {
            // Default JSON format
            return jsonResponse({
              url: targetUrl,
              totalLinks: links.length,
              links
            });
          }
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/css": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");
        const format = url.searchParams.get("format") || "css"; // css or json

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data with CSS info
          const pageData = await getPageData(targetUrl);

          if (!pageData.cssInfo) {
            return jsonResponse({ error: "CSS information not available" }, 500);
          }

          if (format === "json") {
            // Return HTML for display with htmx
            const cssPreview = pageData.cssInfo.extractedCSS.length > 5000
              ? pageData.cssInfo.extractedCSS.substring(0, 5000) + '\n\n/* ... CSS truncated for preview ... */'
              : pageData.cssInfo.extractedCSS;

            const html = `
              <div class="css-stats">
                <h3>CSS Information</h3>
                <p><strong>Stylesheets:</strong> ${pageData.cssInfo.totalStylesheets}</p>
                <p><strong>Inline Styles:</strong> ${pageData.cssInfo.totalInlineStyles}</p>
                <p><strong>Blocked by CORS:</strong> ${pageData.cssInfo.blockedStylesheets}</p>
                <p><strong>Total Size:</strong> ${(pageData.cssInfo.extractedCSS.length / 1024).toFixed(2)} KB</p>
                ${pageData.cssInfo.blockedStylesheets > 0 ? '<p style="color: #f59e0b; font-size: 14px;"><strong>Note:</strong> Some stylesheets are blocked by CORS and could not be extracted. The original &lt;link&gt; tags are preserved in the HTML.</p>' : ''}
                <a href="/css?q=${encodeURIComponent(targetUrl)}" download class="download-css-btn">Download CSS File</a>
              </div>
              <pre class="css-preview">${cssPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            `;

            return new Response(html, {
              headers: { "Content-Type": "text/html" },
            });
          } else {
            // Return raw CSS
            return new Response(pageData.cssInfo.extractedCSS, {
              headers: {
                "Content-Type": "text/css",
                "Content-Disposition": `attachment; filename="styles-${new URL(targetUrl).hostname}.css"`,
              },
            });
          }
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/images": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data with image info
          const pageData = await getPageData(targetUrl);

          if (!pageData.imageInfo) {
            return jsonResponse({ error: "Image information not available" }, 500);
          }

          const info = pageData.imageInfo;

          // Return HTML for display with htmx
          const html = `
            <div class="image-stats">
              <h3>Image Information</h3>
              <div class="stat-grid">
                <div class="stat-item">
                  <span class="stat-label">Total Images:</span>
                  <span class="stat-value">${info.totalImages}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Images with Dimensions:</span>
                  <span class="stat-value">${info.imagesWithDimensions} / ${info.totalImages}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Dimensions Added:</span>
                  <span class="stat-value">${info.imagesAdded}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Total SVGs:</span>
                  <span class="stat-value">${info.totalSVGs}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">SVGs with Dimensions:</span>
                  <span class="stat-value">${info.svgsWithDimensions} / ${info.totalSVGs}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">SVG Dimensions Added:</span>
                  <span class="stat-value">${info.svgsAdded}</span>
                </div>
              </div>
              <div class="info-note">
                <p>✅ All images now have width and height attributes to prevent layout shift</p>
                <p>✅ Lazy loading enabled for better performance</p>
                <p>✅ SVGs have proper viewBox attributes</p>
              </div>
            </div>
          `;

          return new Response(html, {
            headers: { "Content-Type": "text/html" },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/visibility": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data with visibility info
          const pageData = await getPageData(targetUrl);

          if (!pageData.visibilityInfo) {
            return jsonResponse({ error: "Visibility information not available" }, 500);
          }

          const info = pageData.visibilityInfo;
          const totalHidden = info.hiddenElements + info.invisibleElements + info.zeroOpacityElements;

          // Return HTML for display with htmx
          const html = `
            <div class="visibility-stats">
              <h3>Element Visibility Analysis</h3>
              <div class="visibility-summary">
                <div class="progress-circle">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="10"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#28a745" stroke-width="10"
                            stroke-dasharray="${info.visiblePercentage * 2.827} 282.7"
                            transform="rotate(-90 50 50)"/>
                    <text x="50" y="50" text-anchor="middle" dy="0.3em" font-size="20" font-weight="bold">${info.visiblePercentage}%</text>
                  </svg>
                  <p>Visible Elements</p>
                </div>
              </div>
              <div class="stat-grid">
                <div class="stat-item">
                  <span class="stat-label">Total Elements:</span>
                  <span class="stat-value">${info.totalElements}</span>
                </div>
                <div class="stat-item stat-success">
                  <span class="stat-label">Visible:</span>
                  <span class="stat-value">${info.totalElements - totalHidden}</span>
                </div>
                <div class="stat-item stat-warning">
                  <span class="stat-label">display:none:</span>
                  <span class="stat-value">${info.hiddenElements}</span>
                </div>
                <div class="stat-item stat-warning">
                  <span class="stat-label">visibility:hidden:</span>
                  <span class="stat-value">${info.invisibleElements}</span>
                </div>
                <div class="stat-item stat-warning">
                  <span class="stat-label">opacity:0:</span>
                  <span class="stat-value">${info.zeroOpacityElements}</span>
                </div>
                <div class="stat-item stat-info">
                  <span class="stat-label">Off-screen/Collapsed:</span>
                  <span class="stat-value">${info.offscreenElements}</span>
                </div>
              </div>
              <div class="info-note">
                <p>ℹ️ Hidden elements are marked with <code>data-display-none</code>, <code>data-visibility-hidden</code>, or <code>data-opacity-zero</code> attributes</p>
                <p>💡 ${totalHidden} elements (${((totalHidden / info.totalElements) * 100).toFixed(1)}%) are not visible but still in the HTML</p>
              </div>
            </div>
          `;

          return new Response(html, {
            headers: { "Content-Type": "text/html" },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
    "/renderers": {
      GET: () => {
        const renderers = rendererRegistry.getAll().map(r => ({
          name: r.name,
          description: r.description,
          patterns: r.patterns,
          priority: r.priority,
        }));

        return jsonResponse({ renderers });
      },
    },
    "/docs": {
      GET: async () => {
        try {
          // Read the README.md file
          const readmePath = import.meta.dir + "/README.md";
          const readmeFile = Bun.file(readmePath);
          const readmeContent = await readmeFile.text();

          // Convert markdown to HTML using marked
          const htmlContent = await marked.parse(readmeContent);

          // Wrap in a styled container
          const docsHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Documentation - Downmark</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  max-width: 900px;
                  margin: 40px auto;
                  padding: 20px;
                  line-height: 1.6;
                  color: #333;
                  background: #f9fafb;
                }
                h1, h2, h3 { color: #1f2937; }
                h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                h2 { margin-top: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
                code {
                  background: #f3f4f6;
                  padding: 2px 6px;
                  border-radius: 3px;
                  font-family: 'Monaco', 'Courier New', monospace;
                  font-size: 0.9em;
                }
                pre {
                  background: #1f2937;
                  color: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  overflow-x: auto;
                }
                pre code {
                  background: transparent;
                  padding: 0;
                  color: inherit;
                }
                a {
                  color: #2563eb;
                  text-decoration: none;
                }
                a:hover {
                  text-decoration: underline;
                }
                .back-link {
                  display: inline-block;
                  margin-bottom: 20px;
                  color: #6b7280;
                }
              </style>
            </head>
            <body>
              <a href="/" class="back-link">← Back to Converter</a>
              ${htmlContent}
            </body>
            </html>
          `;

          return new Response(docsHtml, {
            headers: { "Content-Type": "text/html" },
          });
        } catch (error: any) {
          return new Response(`Error loading documentation: ${error.message}`, {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }
      },
    },
  },

  // fallback for anything not matched in routes
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://${HOST}:${server.port}`);
