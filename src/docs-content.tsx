/**
 * Documentation content for Downmark
 * This is rendered as a React component and converted to HTML
 */

export function DocsContent() {
  return (
    <div className="docs-content">
      <h1>Downmark Documentation</h1>

      <section>
        <h2>What is Downmark?</h2>
        <p>
          Downmark converts any webpage into clean, readable content using Chrome headless and Mozilla's Readability algorithm.
          It removes clutter, ads, and navigation elements to extract just the main content.
        </p>
      </section>

      <section>
        <h2>How to Use</h2>

        <h3>Basic Usage</h3>
        <p>Simply enter any URL in the search box and press Enter or click "Go".</p>

        <h3>Direct URL Access</h3>
        <p>You can access any page directly by using the URL format:</p>
        <pre><code>http://localhost:3000/https://example.com</code></pre>

        <h3>Shareable Links</h3>
        <p>Every converted page has a shareable URL. Just copy the URL from your browser's address bar.</p>
      </section>

      <section>
        <h2>Features</h2>

        <h3>Clean Reading Experience</h3>
        <p>
          Downmark applies beautiful typography and removes all distractions, giving you a
          focused reading experience similar to reader modes in browsers.
        </p>

        <h3>Style Toggle</h3>
        <p>
          Use the <strong>Style</strong> checkbox to toggle between Downmark's clean CSS
          and the original website's styling.
        </p>

        <h3>Dark Mode</h3>
        <p>
          When using Downmark styles, you can enable <strong>Dark</strong> mode for
          comfortable reading in low-light environments.
        </p>

        <h3>Navigation</h3>
        <ul>
          <li>Use the back/forward arrows to navigate through your browsing history</li>
          <li>Click any link in the content to load it through Downmark</li>
          <li>Cmd+Shift+Click on any link to open the original page in a new tab</li>
        </ul>
      </section>

      <section>
        <h2>Keyboard Shortcuts</h2>
        <ul>
          <li><kbd>Enter</kbd> - Submit URL from search box</li>
          <li><kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Click</kbd> - Open original link in new tab</li>
        </ul>
      </section>

      <section>
        <h2>API Usage</h2>

        <h3>Render Endpoint</h3>
        <p>You can use Downmark programmatically via the API:</p>
        <pre><code>curl "http://localhost:3000/render?q=https://example.com"</code></pre>

        <h3>Response Format</h3>
        <p>The API returns HTML content that can be embedded in your own applications.</p>
      </section>

      <section>
        <h2>Authentication</h2>
        <p>
          Downmark supports optional WebAuthn/Passkey authentication. Enable it by setting
          <code>AUTH_ENABLED=true</code> in your environment configuration.
        </p>
      </section>

      <section>
        <h2>Environment Configuration</h2>

        <h3>Server Settings</h3>
        <ul>
          <li><code>PORT</code> - Server port (default: 3000)</li>
          <li><code>HOST</code> - Server host (default: 0.0.0.0)</li>
        </ul>

        <h3>Browser Settings</h3>
        <ul>
          <li><code>BROWSER_TIMEOUT</code> - Page load timeout in ms (default: 30000)</li>
          <li><code>BROWSER_WAIT_STRATEGY</code> - When to consider page loaded (default: domcontentloaded)</li>
          <li><code>BROWSER_REFERER</code> - Referer header to send (default: https://www.google.com/)</li>
        </ul>
      </section>

      <section>
        <h2>Privacy & Security</h2>
        <ul>
          <li>Downmark runs on your own server - your browsing is private</li>
          <li>No tracking or analytics by default</li>
          <li>All content is processed server-side</li>
          <li>Optional authentication with WebAuthn/Passkeys</li>
        </ul>
      </section>

      <section>
        <h2>Technical Details</h2>

        <h3>Technology Stack</h3>
        <ul>
          <li><strong>Runtime:</strong> Bun</li>
          <li><strong>Browser:</strong> Puppeteer with Chromium</li>
          <li><strong>Content Extraction:</strong> Mozilla Readability</li>
          <li><strong>Frontend:</strong> React with HTMX</li>
          <li><strong>Markdown:</strong> Pandoc</li>
        </ul>

        <h3>How It Works</h3>
        <ol>
          <li>Puppeteer loads the target URL in a headless Chrome browser</li>
          <li>JavaScript executes and the full DOM is captured</li>
          <li>Mozilla's Readability algorithm extracts the main content</li>
          <li>Boilerplate elements (nav, footer, ads) are removed</li>
          <li>Links are transformed to route through Downmark</li>
          <li>Clean HTML is returned and styled for readability</li>
        </ol>
      </section>

      <section>
        <h2>Deployment</h2>

        <h3>Docker</h3>
        <pre><code>docker build -t downmark .
docker run -p 3000:3000 downmark</code></pre>

        <h3>Fly.io</h3>
        <p>See <code>DEPLOYMENT.md</code> for detailed deployment instructions.</p>
      </section>

      <section>
        <h2>Contributing</h2>
        <p>
          Downmark is open source. Visit the{' '}
          <a href="https://github.com/adhipk/downmark" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>{' '}
          to report issues or contribute.
        </p>
      </section>
    </div>
  );
}
