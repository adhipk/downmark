# Downmark

Convert any webpage to clean, readable Markdown using Chrome headless and Mozilla Readability.

## Features

- **Clean Conversion**: Uses Mozilla Readability to extract main content and remove boilerplate
- **Chrome Headless**: Renders JavaScript-heavy pages correctly using Puppeteer
- **Anti-Detection**: Randomized user agents, realistic headers, and proper browser flags
- **Multiple Renderers**: Extensible renderer system with site-specific optimizations
  - **Wikipedia Renderer**: Optimized for Wikipedia articles - removes edit links, citations, navigation boxes
  - **Default Renderer**: Universal content extraction using Mozilla Readability
  - **Custom Renderers**: Easy to add new renderers for specific sites
- **Web UI**: Simple, clean interface for converting URLs to readable content
- **CLI Tool**: Command-line interface for quick conversions
- **Docker Ready**: Full Docker and docker-compose support

## Quick Start

### Installation

**Automated Installation (Recommended)**

Run the install script to automatically set up everything:

```bash
chmod +x install.sh
./install.sh
```

This will:
- Install Bun (if not already installed)
- Install Pandoc (if available via package manager)
- Install project dependencies
- Set up your .env configuration file
- Optionally build the standalone binary

**Manual Installation**

```bash
bun install
cp .env.example .env  # Configure your settings
```

### CLI Usage

Convert a URL to Markdown:

```bash
bun run index.ts https://example.com
```

Or use the binary:

```bash
downmark https://example.com
```

### Web Server

Start the development server:

```bash
bun run dev
```

Start production server:

```bash
bun start
```

Visit `http://localhost:3000` and enter any URL to convert.

## Docker

Build and run with Docker:

```bash
docker build -t downmark .
docker run -p 3000:3000 downmark
```

Or use docker-compose:

```bash
docker-compose up
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Key Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `BROWSER_TIMEOUT` | 30000 | Page load timeout (ms) |
| `BROWSER_REFERER` | https://www.google.com/ | Referer header for requests |

## Features in Detail

### CLI Mode

Extract clean Markdown from any URL:

```bash
bun run index.ts https://example.com > output.md
```

The output includes:
- YAML frontmatter with metadata (title, author, date, etc.)
- Clean Markdown content
- All images converted to absolute URLs

### Web UI

The web interface provides:

- **URL Navigation**: Enter any URL and get instant readable content
- **History**: Back/forward navigation with page caching
- **View Controls**: Toggle styled view and dark mode
- **Smart Rendering**: Automatically selects the best renderer for each site

### Renderer System

Downmark uses a pluggable renderer system that automatically selects the best renderer for each site:

#### Wikipedia Renderer
- **Pattern**: `*.wikipedia.org`
- **Optimizations**:
  - Removes edit links and citation needed tags
  - Cleans up navigation boxes and "See also" sections
  - Removes citation superscripts that break selectors
  - Preserves infoboxes and tables
  - Extracts first paragraph as excerpt
  - Adds article title as H1
- **Priority**: High (10) - runs before default renderer

#### Default Renderer
- **Pattern**: `*` (matches everything)
- **Behavior**:
  - Uses Mozilla Readability for boilerplate removal
  - Extracts metadata from page head tags
  - Transforms images and links
  - Adds article title from metadata
- **Priority**: Low (-1) - fallback for all sites

#### Custom Renderers
You can easily add new renderers for specific sites. Renderers are automatically discovered at startup and matched by URL pattern priority.

## API

### Endpoints

- `GET /render?q=<url>` - Convert URL to readable HTML with metadata
- `GET /renderers` - List available renderers and their patterns
- `GET /config` - Get server configuration
- `GET /docs` - View this documentation

## Development

### Project Structure

```
.
├── index.ts              # CLI entry point
├── server.ts             # Web server
├── src/
│   ├── browser.ts        # Puppeteer browser management
│   ├── extractor.ts      # Content extraction utilities
│   ├── markdown.ts       # Markdown conversion
│   ├── frontend.tsx      # React web UI
│   ├── renderer-registry.ts # Renderer management
│   └── renderers/        # Site-specific renderers
│       ├── base-renderer.ts     # Base class for all renderers
│       ├── default-renderer.ts  # Fallback renderer
│       └── wikipedia-renderer.ts # Wikipedia-specific renderer
├── Dockerfile            # Docker configuration
└── docker-compose.yml    # Docker Compose setup
```

### Adding Custom Renderers

Create a new renderer in `src/renderers/`:

```typescript
import { BaseRenderer } from './base-renderer';
import type { PageData } from '../types';
import type { ProcessedContent } from '../renderer-interface';

export class CustomRenderer extends BaseRenderer {
  readonly name = 'custom';
  readonly description = 'Custom renderer for example.com';
  readonly patterns = ['*.example.com', 'example.com'];
  readonly priority = 10; // Higher priority = runs first

  async process(pageData: PageData, sourceUrl: string): Promise<ProcessedContent> {
    // Custom processing logic here
    // Clean up HTML, extract specific elements, etc.

    return {
      html: pageData.html,
      metadata: pageData.metadata,
      rendererName: this.name,
    };
  }
}
```

Renderers are automatically discovered at startup and matched by URL patterns.

### Testing

```bash
bun test
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for:

- Fly.io
- Railway
- DigitalOcean App Platform
- AWS ECS
- Google Cloud Run
- Self-hosted VPS

## License

MIT License - see [LICENSE](./LICENSE) for details

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [Mozilla Readability](https://github.com/mozilla/readability) - Content extraction
- [Puppeteer](https://pptr.dev/) - Headless Chrome automation
- [Marked](https://marked.js.org/) - Markdown rendering
- [htmx](https://htmx.org/) - HTML-over-the-wire
- [Bun](https://bun.sh/) - Fast JavaScript runtime
