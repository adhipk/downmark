import { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import DOMPurify from "dompurify";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import "./styles.css";
import "./content-styles.css";
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

    if (window.htmx) {
      window.htmx.ajax('GET', `/render?q=${encodeURIComponent(normalizedUrl)}`, {
        target: '#content',
        indicator: '#url-spinner'
      });
    }
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

    // Try to load from cache
    const cached = getCachedPage(url);
    if (cached) {
      const contentDiv = document.getElementById('content');
      if (contentDiv) contentDiv.innerHTML = DOMPurify.sanitize(cached);
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) urlInput.value = url;
      setHistoryIndex(newIndex);
    } else {
      // Re-fetch if not cached
      fetch(`/render?q=${encodeURIComponent(url)}`)
        .then(res => res.text())
        .then(html => {
          const contentDiv = document.getElementById('content');
          if (contentDiv) contentDiv.innerHTML = DOMPurify.sanitize(html);
          setHistoryIndex(newIndex);
        });
    }
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const url = history[newIndex];

    // Try to load from cache
    const cached = getCachedPage(url);
    if (cached) {
      const contentDiv = document.getElementById('content');
      if (contentDiv) contentDiv.innerHTML = DOMPurify.sanitize(cached);
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) urlInput.value = url;
      setHistoryIndex(newIndex);
    } else {
      // Re-fetch if not cached
      fetch(`/render?q=${encodeURIComponent(url)}`)
        .then(res => res.text())
        .then(html => {
          const contentDiv = document.getElementById('content');
          if (contentDiv) contentDiv.innerHTML = DOMPurify.sanitize(html);
          setHistoryIndex(newIndex);
        });
    }
  }, [historyIndex, history]);

  useEffect(() => {
    // Process htmx attributes after component mounts
    if (window.htmx) {
      window.htmx.process(document.body);
    }

    // Set up htmx event listeners for history management
    document.body.addEventListener('htmx:afterRequest', handleAfterRequest);

    return () => {
      document.body.removeEventListener('htmx:afterRequest', handleAfterRequest);
    };
  }, [handleAfterRequest]);

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
