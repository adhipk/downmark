import { closeBrowser } from "./src/browser.ts";
import { fetchPageData } from "./src/page-fetcher.ts";
import { extractContent, removeBoilerplate, transformLinksToHtmx, extractAllLinks, transformImagesToAbsolute } from "./src/extractor.ts";
import { htmlToMarkdown } from "./src/markdown.ts";
import { convertHtmlToMarkdown as pandocConvert, healthCheck as pandocHealthCheck } from "./src/pandoc-client.ts";
import { marked } from "marked";
import * as auth from "./src/auth.ts";
import { rendererRegistry } from "./src/renderer-registry.ts";
import { renderToString } from "react-dom/server";
import { PageTemplate } from "./src/page-template.tsx";
import { DocsContent } from "./src/docs-content.tsx";

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  // Give in-flight requests 10 seconds to complete
  setTimeout(async () => {
    await closeBrowser();
    process.exit(0);
  }, 10000);
});

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

// Helper to render the index.html with optional initial state
function renderIndexWithState(state?: { url?: string; content?: string; error?: { url: string; message: string } }) {
  const html = renderToString(
    <PageTemplate
      url={state?.url}
      content={state?.content}
      error={state?.error}
    />
  );

  // Add DOCTYPE declaration (renderToString doesn't include it)
  return '<!DOCTYPE html>' + html;
}

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

// Check pandoc service health
const pandocAvailable = await pandocHealthCheck();
console.log(`[Server] Pandoc service: ${pandocAvailable ? "✓ Available" : "✗ Not available (markdown conversion disabled)"}`);

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  development: isDev ? {
    hmr: true,
    console: true,
  } : undefined,
  routes: {
    "/guide.md": {
      GET: async () => {
        // Serve the raw markdown file
        try {
          const guidePath = import.meta.dir + "/GUIDE.md";
          const guideFile = Bun.file(guidePath);
          const guideContent = await guideFile.text();

          return new Response(guideContent, {
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        } catch (error: any) {
          return new Response(`Error loading guide: ${error.message}`, {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }
      },
    },
    "/docs": {
      GET: () => {
        // Render docs content as HTML
        const docsHtml = renderToString(<DocsContent />);

        // Wrap in styled content div for Downmark CSS
        const content = `<div id="content" class="styled">${docsHtml}</div>`;

        return new Response(renderIndexWithState({
          url: 'Documentation',
          content
        }), {
          headers: { "Content-Type": "text/html" },
        });
      },
    },
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
    // Dynamic route handler for URL-encoded paths like /https%3A%2F%2Fexample.com%2F
    "/:path": {
      GET: async (req, server) => {
        const url = new URL(req.url);
        const pathname = url.pathname;
        
        // Check if path looks like URL-encoded URL (contains % or starts with http)
        if (!pathname.startsWith('/') || pathname === '/') {
          return null; // Not a URL path, fall through to fetch handler
        }
        
        // Try to decode the path as a URL
        try {
          let decodedUrl = decodeURIComponent(pathname.slice(1)); // Remove leading slash and decode
          
          // Validate it looks like a URL
          if (!decodedUrl.match(/^https?:\/\//)) {
            return null; // Not a URL, fall through
          }
          
          // Check auth if enabled
          if (AUTH_ENABLED) {
            const authError = requireAuth(req);
            if (authError) return authError;
          }
          
          console.log(`[Server] Rendering URL from path: ${decodedUrl}`);
          
          try {
            // Stage 1: Fetch page data
            const pageData = await fetchPageData(decodedUrl, {
              extractVisibility: false,
              extractImages: false,
              extractCss: false,
            });

            // Stage 2: Select renderer
            const renderer = rendererRegistry.selectRenderer(decodedUrl);
            console.log(`[Render] Using renderer: ${renderer.name} for ${decodedUrl}`);

            const processed = await renderer.process(pageData, decodedUrl);
            const response = await renderer.format(processed, decodedUrl);

            // Stage 3: Build response with initial state for React
            let responseHtml = response.content;

            if (response.metadataPanel) {
              responseHtml = response.metadataPanel + "\n" + responseHtml;
            }

            // Scope source CSS if available
            if (pageData.cssInfo && pageData.cssInfo.extractedCSS) {
              const scopeSelector = (selector: string): string => {
                const trimmed = selector.trim();
                if (trimmed.includes('#content')) {
                  return selector;
                }
                if (trimmed.match(/^(html|body|:root)(\s|$|,)/)) {
                  return trimmed.replace(/^(html|body|:root)(\s|$|,)/, '#content$2');
                }
                return `#content ${selector}`;
              };

              const scopedCSS = pageData.cssInfo.extractedCSS
                .split('\n')
                .map(line => {
                  if (!line.trim() || line.trim().startsWith('/*')) return line;
                  if (line.trim().startsWith('@media') || line.trim().startsWith('@supports')) {
                    return line;
                  }
                  if (line.includes('{') && !line.trim().startsWith('@')) {
                    const parts = line.split('{');
                    if (parts.length >= 2) {
                      const selector = parts[0];
                      const rules = parts.slice(1).join('{');
                      const scopedSelectors = selector
                        .split(',')
                        .map(s => scopeSelector(s))
                        .join(', ');
                      return `${scopedSelectors} { ${rules}`;
                    }
                  }
                  return line;
                })
                .join('\n');

              const sourceCSS = `<style id="source-styles">${scopedCSS}</style>`;
              responseHtml = sourceCSS + "\n" + responseHtml;
            }

            // Return as full HTML page with initial state for React
            const fullHtml = renderIndexWithState({
              url: decodedUrl,
              content: responseHtml
            });

            return new Response(fullHtml, {
              headers: { "Content-Type": "text/html" },
            });
          } catch (error: any) {
            console.error(`Error rendering ${decodedUrl}:`, error);
            const fullHtml = renderIndexWithState({
              url: decodedUrl,
              error: { url: decodedUrl, message: error.message }
            });
            return new Response(fullHtml, {
              status: 200,
              headers: { "Content-Type": "text/html" },
            });
          }
        } catch (e) {
          // Not a URL, fall through to fetch handler
          return null;
        }
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
        const rendererName = url.searchParams.get("renderer"); // Optional renderer override

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Stage 1: Fetch page data using smart fetcher (auto-selects best method)
          const pageData = await fetchPageData(targetUrl, {
            extractVisibility: false,  // Skip - not needed for rendering
            extractImages: false,       // Skip - not needed for rendering
            extractCss: false,          // Disabled - causing browser timeouts on fly.io
          });

          // Stage 2: Select and execute renderer
          let renderer;
          if (rendererName) {
            // Use specified renderer if provided
            const allRenderers = rendererRegistry.getAll();
            renderer = allRenderers.find(r => r.name === rendererName);
            if (!renderer) {
              return jsonResponse({ error: `Renderer '${rendererName}' not found` }, 400);
            }
          } else {
            // Auto-select based on URL patterns
            renderer = rendererRegistry.selectRenderer(targetUrl);
          }
          console.log(`[Render] Using renderer: ${renderer.name} for ${targetUrl}`);

          const processed = await renderer.process(pageData, targetUrl);
          const response = await renderer.format(processed, targetUrl);

          // Stage 3: Build final response
          let responseHtml = response.content;

          // Add metadata panel if available
          if (response.metadataPanel) {
            responseHtml = response.metadataPanel + "\n" + responseHtml;
          }

          // Inject source CSS to preserve original layouts (scoped to #content only)
          if (pageData.cssInfo && pageData.cssInfo.extractedCSS) {
            // Helper function to scope a selector
            const scopeSelector = (selector: string): string => {
              const trimmed = selector.trim();

              // Already scoped to #content
              if (trimmed.includes('#content')) {
                return selector;
              }

              // Convert global selectors (html, body, :root) to #content
              if (trimmed.match(/^(html|body|:root)(\s|$|,)/)) {
                return trimmed.replace(/^(html|body|:root)(\s|$|,)/, '#content$2');
              }

              // Scope regular selectors
              return `#content ${selector}`;
            };

            // Scope all CSS to #content to prevent it from affecting page chrome
            const scopedCSS = pageData.cssInfo.extractedCSS
              .split('\n')
              .map(line => {
                // Skip empty lines and comments
                if (!line.trim() || line.trim().startsWith('/*')) return line;

                // Handle @media, @supports, etc. - keep them but scope their contents
                if (line.trim().startsWith('@media') || line.trim().startsWith('@supports')) {
                  return line; // Return as-is, will scope the rules inside
                }

                // If line contains a selector (ends with { or has rules), scope it
                if (line.includes('{') && !line.trim().startsWith('@')) {
                  // Extract selector and rules
                  const parts = line.split('{');
                  if (parts.length >= 2) {
                    const selector = parts[0];
                    const rules = parts.slice(1).join('{');

                    // Handle multiple selectors separated by commas
                    const scopedSelectors = selector
                      .split(',')
                      .map(s => scopeSelector(s))
                      .join(', ');

                    return `${scopedSelectors} { ${rules}`;
                  }
                }
                return line;
              })
              .join('\n');

            const sourceCSS = `
              <style id="source-styles">
                ${scopedCSS}
              </style>
            `;
            responseHtml = sourceCSS + "\n" + responseHtml;
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
          let { html } = await fetchPageData(targetUrl);

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
          const { html } = await fetchPageData(targetUrl);

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
          // Fetch page data with CSS info only
          const pageData = await fetchPageData(targetUrl, { extractCss: true });

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
          // Fetch page data with image info only
          const pageData = await fetchPageData(targetUrl, { extractImages: true });

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
          // Fetch page data with visibility info only
          const pageData = await fetchPageData(targetUrl, { extractVisibility: true });

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
    "/markdown": {
      GET: async (req) => {
        // Check auth if enabled
        if (AUTH_ENABLED) {
          const authError = requireAuth(req);
          if (authError) return authError;
        }

        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");
        const usePandoc = url.searchParams.get("pandoc") !== "false"; // Default to true

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data using smart fetcher
          const pageData = await fetchPageData(targetUrl);

          // Process with appropriate renderer
          const renderer = rendererRegistry.selectRenderer(targetUrl);
          console.log(`[Markdown] Using renderer: ${renderer.name} for ${targetUrl}`);

          const processed = await renderer.process(pageData, targetUrl);

          // Convert to markdown
          let markdown: string;
          if (!pandocAvailable) {
            throw new Error("Pandoc service is not available. Please check PANDOC_SERVICE_URL environment variable.");
          }

          if (usePandoc) {
            console.log("[Markdown] Using Pandoc service for conversion");
            markdown = await pandocConvert(processed.html);
          } else {
            // Use pandoc service for plain HTML conversion (no processing)
            console.log("[Markdown] Using Pandoc service (direct HTML conversion)");
            const { parseDocument } = await import("linkedom");
            const doc = parseDocument(processed.html);
            const bodyHTML = doc.body?.innerHTML || processed.html;
            markdown = await pandocConvert(bodyHTML);
          }

          // Return as plain text or JSON based on Accept header
          const accept = req.headers.get("accept") || "";
          if (accept.includes("application/json")) {
            return jsonResponse({
              url: targetUrl,
              markdown,
              metadata: processed.metadata,
              rendererUsed: processed.rendererName,
              converterUsed: usePandoc && pandocAvailable ? "pandoc" : "built-in",
            });
          } else {
            return new Response(markdown, {
              headers: { "Content-Type": "text/markdown; charset=utf-8" },
            });
          }
        } catch (error: any) {
          console.error(`Error converting ${targetUrl} to markdown:`, error);
          return jsonResponse({ error: error.message }, 500);
        }
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
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Serve static files from public
    if (pathname.startsWith('/public/')) {
      const filePath = import.meta.dir + pathname;
      try {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
      } catch (e) {
        // Not found
      }
    }

    // Serve CSS from src
    if (pathname.startsWith('/src/') && pathname.endsWith('.css')) {
      const filePath = import.meta.dir + pathname;
      try {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'text/css' } });
        }
      } catch (e) {
        // Not found
      }
    }

    // Skip static files and favicon
    if (/\.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i.test(pathname)) {
      return new Response('Not Found', { status: 404 });
    }

    // For any other route not handled by routes above, serve index.html (SPA fallback)
    // But skip if it looks like a URL-encoded path (those should be handled by /:path route)
    const looksLikeUrlPath = pathname.includes('%') || 
                             (pathname.length > 1 && /^\/[a-zA-Z0-9%\-._~:/?#\[\]@!$&'()*+,;=]+$/.test(pathname));
    
    if (!looksLikeUrlPath &&
        !pathname.startsWith('/api/') && 
        !pathname.startsWith('/auth/') &&
        !pathname.startsWith('/render') &&
        !pathname.startsWith('/markdown') &&
        !pathname.startsWith('/guide') &&
        !pathname.startsWith('/docs') &&
        !pathname.startsWith('/config') &&
        !pathname.startsWith('/renderers')) {
      try {
        const indexPath = import.meta.dir + "/index.html";
        const indexFile = Bun.file(indexPath);
        if (await indexFile.exists()) {
          const html = await indexFile.text();
          return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        }
      } catch (e) {
        // Fall through
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://${HOST}:${server.port}`);
