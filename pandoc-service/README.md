# Pandoc Microservice

Lightweight microservice for converting HTML to Markdown using Pandoc.

## Features

- Fast HTML to Markdown conversion
- Low memory footprint (512MB)
- Batch conversion support
- Health check endpoint

## API Endpoints

### POST /convert

Convert HTML to Markdown.

**Request:**
```json
{
  "html": "<h1>Hello World</h1>",
  "from": "html",
  "to": "markdown",
  "extraArgs": []
}
```

**Response:**
```json
{
  "success": true,
  "markdown": "# Hello World\n",
  "length": 14
}
```

### POST /convert/batch

Convert multiple HTML strings in one request.

**Request:**
```json
{
  "conversions": [
    { "html": "<h1>First</h1>" },
    { "html": "<h2>Second</h2>" }
  ]
}
```

### GET /health

Health check endpoint.

## Deployment

### Local Testing

```bash
cd pandoc-service
bun install
bun run server.ts
```

### Deploy to Fly.io

```bash
cd pandoc-service
flyctl launch --name downmark-pandoc
flyctl deploy
```

### Get Internal URL

After deployment, get the internal URL:

```bash
flyctl info
```

Use the internal DNS name (e.g., `downmark-pandoc.internal:3001`) in your main app's `PANDOC_SERVICE_URL` environment variable.

## Environment Variables

- `PORT`: Port to listen on (default: 3001)
- `HOST`: Host to bind to (default: 0.0.0.0)
