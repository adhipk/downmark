import { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Code2 from "lucide-react/dist/esm/icons/code-2";
import Link from "lucide-react/dist/esm/icons/link";
import Shield from "lucide-react/dist/esm/icons/shield";
import Image from "lucide-react/dist/esm/icons/image";
import Eye from "lucide-react/dist/esm/icons/eye";
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
  const [customStyling, setCustomStyling] = useState(true);
  const [darkTheme, setDarkTheme] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [urlError, setUrlError] = useState<string>("");
  const debounceTimerRef = useRef<number | null>(null);

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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!url.trim()) {
      setUrlError("");
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      const normalizedUrl = normalizeUrl(url);

      if (!normalizedUrl) {
        setUrlError("Please enter a valid URL (e.g., example.com or https://example.com)");
        return;
      }

      setUrlError("");

      if (window.htmx) {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement;
        if (urlInput) {
          window.htmx.ajax('GET', `/render?q=${encodeURIComponent(normalizedUrl)}`, {
            target: '#content',
            indicator: '#loading'
          });
        }
      }
    }, 500); // 500ms debounce
  }, []);

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
      if (contentDiv) contentDiv.innerHTML = cached;
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) urlInput.value = url;
      setHistoryIndex(newIndex);
    } else {
      // Re-fetch if not cached
      fetch(`/render?q=${encodeURIComponent(url)}`)
        .then(res => res.text())
        .then(html => {
          const contentDiv = document.getElementById('content');
          if (contentDiv) contentDiv.innerHTML = html;
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
      if (contentDiv) contentDiv.innerHTML = cached;
      const urlInput = document.getElementById('urlInput') as HTMLInputElement;
      if (urlInput) urlInput.value = url;
      setHistoryIndex(newIndex);
    } else {
      // Re-fetch if not cached
      fetch(`/render?q=${encodeURIComponent(url)}`)
        .then(res => res.text())
        .then(html => {
          const contentDiv = document.getElementById('content');
          if (contentDiv) contentDiv.innerHTML = html;
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
      // Cleanup debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleAfterRequest]);

  useEffect(() => {
    // Apply/remove custom styling class to content
    const contentDiv = document.getElementById('content');
    if (contentDiv) {
      if (customStyling) {
        contentDiv.classList.add('styled');
      } else {
        contentDiv.classList.remove('styled');
      }
    }

    // Apply/remove dark mode to entire document
    if (darkTheme) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [customStyling, darkTheme]);

  return (
    <>
      {username && (
        <div className="user-info">
          <span>Signed in as <strong>{username}</strong></span>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      )}

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

          <div className="url-form">
            <input
              type="text"
              name="q"
              id="urlInput"
              placeholder="Enter URL..."
              defaultValue=""
              onChange={(e) => handleUrlChange(e.target.value)}
              className={urlError ? "error" : ""}
            />
            {urlError && <span className="url-error">{urlError}</span>}
          </div>
        </div>

        <div className="controls-bar">
          <div className="action-buttons">
            <button
              type="button"
              hx-get="/original"
              hx-target="#content"
              hx-include="[name='q']"
              hx-indicator="#loading"
              className="tool-btn"
              title="Original HTML"
            >
              <Code2 size={16} />
            </button>
            <button
              type="button"
              hx-get="/links?format=text"
              hx-target="#links-list"
              hx-include="[name='q']"
              hx-indicator="#loading"
              hx-swap="innerHTML"
              className="tool-btn"
              title="Links"
            >
              <Link size={16} />
            </button>
            <button
              type="button"
              hx-get="/css?format=json"
              hx-target="#css-info"
              hx-include="[name='q']"
              hx-indicator="#loading"
              hx-swap="innerHTML"
              className="tool-btn"
              title="CSS"
            >
              <Shield size={16} />
            </button>
            <button
              type="button"
              hx-get="/images"
              hx-target="#image-info"
              hx-include="[name='q']"
              hx-indicator="#loading"
              hx-swap="innerHTML"
              className="tool-btn"
              title="Images"
            >
              <Image size={16} />
            </button>
            <button
              type="button"
              hx-get="/visibility"
              hx-target="#visibility-info"
              hx-include="[name='q']"
              hx-indicator="#loading"
              hx-swap="innerHTML"
              className="tool-btn"
              title="Visibility"
            >
              <Eye size={16} />
            </button>
          </div>

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

      <div id="loading" className="htmx-indicator">Loading...</div>
      <div id="links-list" className="links-container"></div>
      <div id="css-info" className="css-info-container"></div>
      <div id="image-info" className="image-info-container"></div>
      <div id="visibility-info" className="visibility-info-container"></div>
      <div id="metadata-panel" className="metadata-panel"></div>
      <main id="content"></main>
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
