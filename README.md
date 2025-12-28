# Downmark

Convert any webpage to clean, readable Markdown using Chrome headless and Mozilla Readability.

## Features

- **Clean Conversion**: Uses Mozilla Readability to extract main content and remove boilerplate
- **Chrome Headless**: Renders JavaScript-heavy pages correctly using Puppeteer
- **Anti-Detection**: Randomized user agents, realistic headers, and proper browser flags
- **Multiple Renderers**: Extensible renderer system with site-specific optimizations (Wikipedia, etc.)
- **Web UI**: Modern React interface with HTMX for seamless navigation
- **CLI Tool**: Command-line interface for quick conversions
- **Authentication**: Optional passkey/WebAuthn support for private deployments
- **Analysis Tools**: Extract links, CSS, images, and visibility info from any page
- **Docker Ready**: Full Docker and docker-compose support

## Quick Start

### Installation

```bash
bun install
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
| `AUTH_ENABLED` | false | Enable passkey authentication |
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

- **URL Navigation**: Enter any URL and get instant Markdown preview
- **History**: Back/forward navigation with page caching
- **View Controls**: Toggle styled view and dark mode
- **Analysis Tools**:
  - Extract all links from a page
  - Download extracted CSS
  - View image information and dimensions
  - Analyze element visibility

### Renderer System

Downmark uses a pluggable renderer system that allows site-specific optimizations:

- **Default Renderer**: Uses Mozilla Readability for clean content extraction
- **Wikipedia Renderer**: Optimized for Wikipedia articles with proper formatting
- **Custom Renderers**: Easy to add new renderers for specific sites

### Authentication

Enable passkey authentication for private deployments:

```bash
AUTH_ENABLED=true
RP_NAME=Downmark
RP_ID=yourdomain.com
ORIGIN=https://yourdomain.com
```

Users can register and sign in using WebAuthn/passkeys (fingerprint, Face ID, hardware keys).

## API

### Endpoints

- `GET /render?q=<url>` - Convert URL to Markdown HTML
- `GET /original?q=<url>` - Get original HTML with transformed links
- `GET /links?q=<url>&format=json|text|queryparams` - Extract all links
- `GET /css?q=<url>&format=css|json` - Extract CSS
- `GET /images?q=<url>` - Get image information
- `GET /visibility?q=<url>` - Analyze element visibility
- `GET /renderers` - List available renderers
- `GET /docs` - View documentation

### Authentication API

- `POST /auth/register/start` - Start passkey registration
- `POST /auth/register/finish` - Complete registration
- `POST /auth/login/start` - Start authentication
- `POST /auth/login/finish` - Complete authentication
- `POST /auth/logout` - Sign out
- `GET /auth/status` - Check auth status
- `GET /config` - Get server configuration

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
│   ├── auth.ts           # Authentication logic
│   ├── frontend.tsx      # React web UI
│   ├── auth-ui.tsx       # Authentication UI
│   ├── renderer-registry.ts # Renderer management
│   └── renderers/        # Site-specific renderers
├── Dockerfile            # Docker configuration
└── docker-compose.yml    # Docker Compose setup
```

### Adding Custom Renderers

Create a new renderer in `src/renderers/`:

```typescript
import { BaseRenderer } from './base-renderer';
import { PageData, ProcessedData } from '../types';

export class CustomRenderer extends BaseRenderer {
  name = 'custom-renderer';
  description = 'Custom renderer for example.com';
  patterns = [/example\.com/];
  priority = 10;

  async process(pageData: PageData, url: string): Promise<ProcessedData> {
    // Custom processing logic
    return {
      title: pageData.metadata.title,
      content: pageData.html,
      metadata: pageData.metadata,
    };
  }

  async format(data: ProcessedData, url: string): Promise<{ content: string; metadataPanel?: string }> {
    // Custom formatting logic
    return {
      content: `<article>${data.content}</article>`,
    };
  }
}
```

Renderers are automatically discovered on server start.

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
