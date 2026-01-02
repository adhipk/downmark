# Deployment Guide

## ⚠️ Vercel Limitations

**Update**: Vercel is **not suitable** for this application because:
- Serverless functions don't support Puppeteer/headless Chrome
- No Chrome binary available in serverless environment
- Strict TypeScript compilation fails on some dependencies
- Memory/timeout limits too restrictive for browser automation

## Recommended Platforms

### Railway (Recommended)
Best for Docker-based deployments with long-running processes.
- Native Docker support
- Better resource allocation
- Simple pricing
- Good for Puppeteer apps

### Render
Good alternative with similar Docker support.

### Fly.io with Upgraded Resources
Your current platform - upgrade the VM for better performance.

### Architecture Overview

Downmark consists of two services:
1. **Main App** - Web UI and HTML rendering with Puppeteer
2. **Pandoc Service** - Markdown conversion microservice

### Prerequisites

1. Install Vercel CLI:
   ```bash
   bun install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

### Deploying the Main Application

1. **Initial Setup:**
   ```bash
   vercel
   ```
   Follow the prompts to link your project to Vercel.

2. **Configure Environment Variables:**

   In your Vercel project settings (or using the CLI), set the following environment variables:

   ```bash
   # Required
   vercel env add NODE_ENV production
   vercel env add PORT 3000
   vercel env add HOST 0.0.0.0

   # Pandoc Service URL (after deploying pandoc-service)
   vercel env add PANDOC_SERVICE_URL https://your-pandoc-service.vercel.app

   # Optional: Authentication
   vercel env add AUTH_ENABLED false
   vercel env add RP_ID your-app.vercel.app
   vercel env add RP_NAME "Downmark - Web to Markdown"
   vercel env add ORIGIN https://your-app.vercel.app
   ```

3. **Deploy:**
   ```bash
   bun run deploy:vercel
   # or
   vercel --prod
   ```

### Deploying the Pandoc Service

The pandoc service should be deployed as a separate Vercel project:

1. **Navigate to pandoc-service directory:**
   ```bash
   cd pandoc-service
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Copy the deployment URL** and use it as the `PANDOC_SERVICE_URL` environment variable in the main application.

### Fluid Compute Benefits

Vercel automatically detects the Dockerfile and uses Fluid Compute for deployment. This provides:

- **Container-based deployment** for full control over dependencies
- **Automatic scaling** based on traffic
- **Better resource allocation** for memory-intensive operations like Puppeteer
- **Chrome/Chromium** pre-installed via Dockerfile
- **No resource constraints** unlike Fly.io's shared CPU limits

### Monitoring

Monitor your deployment:
```bash
vercel logs
```

Or view logs in the Vercel dashboard.

### Rolling Back

If you need to rollback to a previous deployment:
```bash
vercel rollback
```

---

## Fly.io (Legacy - Not Recommended)

The previous Fly.io configuration experienced resource constraints with Puppeteer. Configuration files are preserved but Vercel is recommended.

### Files for Fly.io deployment:
- `fly.toml` - Main application configuration
- `pandoc-service/fly.toml` - Pandoc service configuration

### Deploying to Fly.io:
```bash
flyctl deploy
cd pandoc-service && flyctl deploy
```

---

## Local Development

For local development:

```bash
# Install dependencies
bun install

# Run in development mode with hot reload
bun run dev

# Run with pandoc service
bun run dev:all
```

## Docker (Local Testing)

Test the production Docker image locally:

```bash
# Build the image
bun run docker:build

# Run the container
bun run docker:run
```

Visit `http://localhost:3000` to test the application.
