import { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import DOMPurify from "dompurify";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { AuthUI } from "./auth-ui";

declare global {
  interface Window {
    htmx: any;
  }
}

interface PageCache {
  url: string;
  html: string;
  timestamp: number;
}

function ConverterApp({ username, onLogout }: { username: string | null; onLogout: () => void }) {
  const [customStyling, setCustomStyling] = useState(true); // true = Downmark CSS, false = Source CSS
  const [darkTheme, setDarkTheme] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [urlError, setUrlError] = useState<string>("");

  const getCache = (): PageCache[] => {
    try {
      const cached = sessionStorage.getItem('pageCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  };

  const cachePage = useCallback((url: string, html: string) => {
    try {
      const cache = getCache();
      cache.push({ url, html, timestamp: Date.now() });
      // Keep only last 5 pages
      if (cache.length > 5) cache.shift();
      sessionStorage.setItem('pageCache', JSON.stringify(cache));
    } catch (e) {
      console.error('Failed to cache page:', e);
    }
  }, []);

  const getCachedPage = (url: string): string | null => {
    const cache = getCache();
    const page = cache.find(p => p.url === url);
    return page ? page.html : null;
  };

  const normalizeUrl = (input: string): string | null => {
    let url = input.trim();

    if (!url) return null;

    // If it doesn't start with http:// or https://, add https://
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    // Basic URL validation
    try {
      const urlObj = new URL(url);

      // Check if it has a valid protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return null;
      }

      // Check if it has a hostname
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        return null;
      }

      // Check if hostname has at least one dot (e.g., example.com)
      // Allow localhost and IP addresses as exceptions
      if (!urlObj.hostname.includes('.') &&
          !urlObj.hostname.match(/^localhost$/i) &&
          !urlObj.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return null;
      }

      return urlObj.href;
    } catch (e) {
      return null;
    }
  };

  const handleUrlChange = useCallback((url: string) => {
    if (!url.trim()) {
      setUrlError("");
      return;
    }

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      setUrlError("Please enter a valid URL (e.g., example.com or https://example.com)");
    } else {
      setUrlError("");
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) return;

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      setUrlError("Please enter a valid URL (e.g., example.com or https://example.com)");
      return;
    }

    setUrlError("");

    // Check if we're currently using AI renderer (path starts with /ai/)
    const isAiMode = window.location.pathname.startsWith('/ai/');

    // Navigate to the URL using the new shareable format (URL-encoded)
    const prefix = isAiMode ? '/ai/' : '/';
    window.location.href = `${prefix}${encodeURIComponent(normalizedUrl)}`;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleAfterRequest = useCallback((event: any) => {
    // Get the URL from the input field
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    if (!urlInput || !urlInput.value) return;

    const url = urlInput.value;
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    // Cache the page
    cachePage(url, contentDiv.innerHTML);

    // Update history
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(url);
      // Keep only last 10 URLs in history
      if (newHistory.length > 10) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 9)); // Cap at 9 since we keep 10 items
  }, [cachePage, historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const url = history[newIndex];
    if (!url) return;

    // Check if we're currently using AI renderer (path starts with /ai/)
    const isAiMode = window.location.pathname.startsWith('/ai/');

    // Navigate using the new URL format (URL-encoded)
    const prefix = isAiMode ? '/ai/' : '/';
    window.location.href = `${prefix}${encodeURIComponent(url)}`;
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const url = history[newIndex];
    if (!url) return;

    // Check if we're currently using AI renderer (path starts with /ai/)
    const isAiMode = window.location.pathname.startsWith('/ai/');

    // Navigate using the new URL format (URL-encoded)
    const prefix = isAiMode ? '/ai/' : '/';
    window.location.href = `${prefix}${encodeURIComponent(url)}`;
  }, [historyIndex, history]);

  const extractMetadata = useCallback(() => {
    try {
      const contentDiv = document.getElementById('content');
      if (!contentDiv) return;

      // Extract title from various sources
      let title = '';
      
      // Try h1 tag first
      const h1 = contentDiv.querySelector('h1');
      if (h1) {
        title = h1.textContent || '';
      }
      
      // Try to extract from meta tags if present
      if (!title) {
        const metaTitle = contentDiv.querySelector('meta[name="og:title"]');
        if (metaTitle) {
          title = metaTitle.getAttribute('content') || '';
        }
      }

      // Extract description from meta tags
      let description = '';
      const metaDesc = contentDiv.querySelector('meta[name="og:description"]') || 
                       contentDiv.querySelector('meta[name="description"]');
      if (metaDesc) {
        description = metaDesc.getAttribute('content') || '';
      }

      // Populate metadata panel
      const metadataPanel = document.getElementById('metadata-panel');
      if (metadataPanel) {
        if (title || description) {
          metadataPanel.innerHTML = `
            <div class="metadata-content">
              ${title ? `<h2 class="page-heading">${DOMPurify.sanitize(title)}</h2>` : ''}
              ${description ? `<p class="page-description">${DOMPurify.sanitize(description)}</p>` : ''}
            </div>
          `;
        } else {
          metadataPanel.innerHTML = '';
        }
      }
    } catch (error) {
      console.error('[Frontend] Error extracting metadata:', error);
    }
  }, []);

  useEffect(() => {
    // Process htmx attributes after component mounts
    if (window.htmx) {
      window.htmx.process(document.body);
    }

    // Set up htmx event listeners for history management
    document.body.addEventListener('htmx:afterRequest', handleAfterRequest);

    // Handle link clicks in content area
    const handleContentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      // Cmd+Shift+Click: Open actual link in new tab
      if (e.metaKey && e.shiftKey) {
        e.preventDefault();
        window.open(href, '_blank');
        return;
      }

      // Regular click: Navigate to localhost/url
      if (!link.hasAttribute('hx-get') && !link.hasAttribute('hx-post')) {
        e.preventDefault();

        // Make URL absolute if it's relative
        let absoluteUrl = href;
        try {
          if (!href.match(/^https?:\/\//)) {
            const currentUrl = (window as any).__INITIAL_URL__;
            if (currentUrl) {
              absoluteUrl = new URL(href, currentUrl).href;
            }
          }

          // Check if we're currently using AI renderer (path starts with /ai/)
          const isAiMode = window.location.pathname.startsWith('/ai/');

          // Navigate to localhost/url format, preserving AI mode if active
          const prefix = isAiMode ? '/ai/' : '/';
          window.location.href = `${prefix}${encodeURIComponent(absoluteUrl)}`;
        } catch (err) {
          console.error('Error processing link:', err);
        }
      }
    };

    document.body.addEventListener('click', handleContentClick);

    // Check for initial URL and content from server
    const initialUrl = (window as any).__INITIAL_URL__;
    const initialContent = (window as any).__INITIAL_CONTENT__;
    const initialError = (window as any).__INITIAL_ERROR__;

    if (initialUrl && initialContent) {
      // Pre-populate the URL input
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) {
        urlInput.value = initialUrl;
      }

      // Pre-populate the content div
      const contentDiv = document.getElementById('content');
      if (contentDiv) {
        contentDiv.innerHTML = DOMPurify.sanitize(initialContent);
        // Extract and display metadata
        setTimeout(() => extractMetadata(), 0);
      }

      // Add to history
      setHistory([initialUrl]);
      setHistoryIndex(0);
      cachePage(initialUrl, initialContent);
    } else if (initialError) {
      // Show error
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) {
        urlInput.value = initialError.url;
      }

      const contentDiv = document.getElementById('content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px; color: #c00;">
            <h3 style="margin-top: 0;">Error Loading Page</h3>
            <p><strong>URL:</strong> ${initialError.url}</p>
            <p><strong>Error:</strong> ${initialError.message}</p>
            <p style="font-size: 0.9em; color: #666;">This could be due to timeout, network issues, or the site blocking automated access.</p>
          </div>
        `;
      }
    }

    return () => {
      document.body.removeEventListener('htmx:afterRequest', handleAfterRequest);
      document.body.removeEventListener('click', handleContentClick);
    };
  }, [handleAfterRequest, cachePage]);

  useEffect(() => {
    // Handle CSS styling
    // customStyling = true → Downmark CSS (can use dark mode)
    // customStyling = false → Source CSS (no dark mode)
    const contentDiv = document.getElementById('content');
    const sourceStyleElement = document.getElementById('source-styles') as HTMLStyleElement;

    if (contentDiv) {
      if (customStyling) {
        // Use Downmark CSS
        contentDiv.classList.add('styled');
        contentDiv.classList.remove('using-source-css');
        if (sourceStyleElement) {
          sourceStyleElement.disabled = true; // Disable source CSS
        }
      } else {
        // Use source CSS
        contentDiv.classList.remove('styled');
        contentDiv.classList.add('using-source-css');
        if (sourceStyleElement) {
          sourceStyleElement.disabled = false; // Enable source CSS
        }
      }
    }

    // Apply/remove dark mode
    // Dark mode only works with Downmark CSS
    // UI chrome gets dark mode, content is excluded via CSS when using source CSS
    if (darkTheme && customStyling) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [customStyling, darkTheme]);

  return (
    <>
      <div className="header">
        <h1 className="page-title">Downmark</h1>

        {username && (
          <div className="user-info">
            <span>Signed in as <strong>{username}</strong></span>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="nav-bar">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="nav-btn"
            title="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="nav-btn"
            title="Forward"
          >
            <ChevronRight size={18} />
          </button>

          <div className="url-form-container">
            <div className="url-form">
              <div className="url-input-wrapper">
                <input
                  type="text"
                  name="q"
                  id="urlInput"
                  placeholder="Enter URL..."
                  defaultValue=""
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={urlError ? "error" : ""}
                />
                <div className="loading-spinner htmx-indicator" id="url-spinner"></div>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                className="submit-btn"
                title="Convert (Enter)"
              >
                Go
              </button>
            </div>
            {urlError && <span className="url-error">{urlError}</span>}
          </div>
        </div>

        <div className="controls-bar">
          <div className="view-controls">
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={customStyling}
                onChange={(e) => setCustomStyling(e.target.checked)}
              />
              <span>Style</span>
            </label>
            {customStyling && (
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={darkTheme}
                  onChange={(e) => setDarkTheme(e.target.checked)}
                />
                <span>Dark</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div id="metadata-panel" className="metadata-panel"></div>
      <main id="content"></main>

      <footer className="app-footer">
        <a href="/docs">
          Documentation
        </a>
        <span>·</span>
        <a href="https://github.com/adhipk/downmark" target="_blank" rel="noopener noreferrer">
          Source Code
        </a>
        <span>·</span>
        <a href="https://github.com/adhipk" target="_blank" rel="noopener noreferrer">
          @adhipk
        </a>
      </footer>
    </>
  );
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    // Fetch config to check if auth is enabled
    fetch("/config")
      .then((res) => res.json())
      .then((config) => {
        setAuthEnabled(config.authEnabled);

        if (config.authEnabled) {
          // Check auth status
          return fetch("/auth/status").then((res) => res.json());
        } else {
          return { authenticated: true, username: null };
        }
      })
      .then((data) => {
        setAuthenticated(data.authenticated);
        setUsername(data.username);
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthChecked(true);
        setAuthenticated(true);
      });
  }, []);

  const handleAuthenticated = (user: string) => {
    setUsername(user);
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setUsername(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (!authChecked) {
    return <div>Loading...</div>;
  }

  if (authEnabled && !authenticated) {
    return <AuthUI onAuthenticated={handleAuthenticated} />;
  }

  return <ConverterApp username={username} onLogout={handleLogout} />;
}

// Singleton root for HMR
let root: ReturnType<typeof createRoot> | null = null;

function render() {
  const container = document.getElementById("root")!;

  if (!root) {
    root = createRoot(container);
  }

  root.render(<App />);
}

render();

// Support HMR
if (import.meta.hot) {
  import.meta.hot.accept();
}
