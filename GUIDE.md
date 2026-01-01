# Downmark

**Convert any webpage to clean, readable markdown**

Downmark is a web service that transforms web pages into beautiful, distraction-free reading experiences. It strips away clutter, preserves the content that matters, and gives you multiple output formats.

## How to Use

### Basic Conversion

Simply paste any URL into the input field and press Enter. Downmark will:

1. Fetch the webpage
2. Remove boilerplate and clutter
3. Extract the main content
4. Render it in a clean, readable format

### Example URLs

Try these examples to see Downmark in action:

- **News Article**: `https://www.nytimes.com/` (any article)
- **Blog Post**: `https://medium.com/` (any article)
- **Documentation**: `https://docs.github.com/`
- **GitHub README**: `https://github.com/adhipk/downmark`

### Output Formats

Downmark supports multiple output formats via URL paths:

#### 1. Rendered HTML (Default)
```
https://downmark.fly.dev/https://example.com
```
Get a clean, styled HTML version with navigation controls.

#### 2. Markdown
```
https://downmark.fly.dev/markdown?q=https://example.com
```
Download the content as clean markdown, perfect for:
- Note-taking apps (Obsidian, Notion, etc.)
- Documentation
- Archiving articles

#### 3. Extract Links
```
https://downmark.fly.dev/links?q=https://example.com&format=text
```
Extract all links from a page. Formats available:
- `format=json` - Structured JSON with metadata
- `format=text` - Simple list, one URL per line
- `format=queryparams` - URL-encoded query string

#### 4. CSS Extraction
```
https://downmark.fly.dev/css?q=https://example.com
```
Download all CSS from a page, useful for theme preservation.

## Features

### Smart Content Extraction

Downmark uses intelligent algorithms to identify and preserve the main content while removing:

- Navigation bars
- Sidebars
- Ads and promotional content
- Cookie banners
- Social media widgets
- Related articles sections

### Specialized Renderers

Downmark automatically detects the content type and applies the best renderer:

- **AI Renderer**: For complex pages requiring intelligent content extraction
- **GitHub Renderer**: Optimized for GitHub repositories and issues
- **Default Renderer**: General-purpose content extraction

You can override the automatic selection:
```
https://downmark.fly.dev/https://example.com?renderer=ai
```

### Image & Style Preservation

- Images are loaded with proper dimensions to prevent layout shift
- Lazy loading for better performance
- SVG support with proper viewBox attributes
- Original page CSS can be preserved (scoped to prevent conflicts)

## API Usage

All endpoints accept a `q` query parameter with the target URL:

```bash
# Get rendered HTML
curl "https://downmark.fly.dev/render?q=https://example.com"

# Get markdown
curl "https://downmark.fly.dev/markdown?q=https://example.com"

# Get links as JSON
curl "https://downmark.fly.dev/links?q=https://example.com"

# Get CSS
curl "https://downmark.fly.dev/css?q=https://example.com"
```

## Authentication

Downmark can be configured with WebAuthn authentication for private deployments. Set `AUTH_ENABLED=true` in your environment to enable passkey-based authentication.

## Self-Hosting

Downmark is open source and can be self-hosted:

```bash
git clone https://github.com/adhipk/downmark
cd downmark
bun install
bun run server.tsx
```

Set up the Pandoc service for markdown conversion:

```bash
cd pandoc-service
bun install
bun run server.tsx
```

## Configuration

Environment variables:

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `PANDOC_SERVICE_URL` - Pandoc service URL for markdown conversion
- `AUTH_ENABLED` - Enable authentication (default: false)
- `RP_ID` - Relying party ID for WebAuthn
- `BROWSER_TIMEOUT` - Timeout for browser operations (ms)

## Technical Details

Built with:
- **Bun** - Fast JavaScript runtime
- **Puppeteer** - Headless browser for page rendering
- **Pandoc** - High-quality markdown conversion
- **HTMX** - Dynamic UI updates without JavaScript frameworks

## Source Code

Downmark is open source: [github.com/adhipk/downmark](https://github.com/adhipk/downmark)

---

*This page itself is a demonstration of Downmark's capabilities - it's a markdown file being rendered through the conversion pipeline!*
