# Deployment Guide

This guide covers deploying Downmark's microservices architecture to Fly.io.

## Architecture Overview

Downmark consists of two services:

1. **Main App** (`downmark`) - Web UI and HTML rendering
2. **Pandoc Service** (`downmark-pandoc`) - Markdown conversion microservice

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account created and authenticated

```bash
flyctl auth login
```

## 1. Deploy Pandoc Microservice

The pandoc service must be deployed first since the main app depends on it.

```bash
cd pandoc-service
flyctl launch --name downmark-pandoc --region sjc
flyctl deploy
```

After deployment, get the internal URL. The internal URL will be: `http://downmark-pandoc.internal:3001`

## 2. Deploy Main App

Update environment variables:

```bash
cd ..  # Back to project root
flyctl secrets set PANDOC_SERVICE_URL=http://downmark-pandoc.internal:3001
flyctl deploy
```

## 3. Verify Deployment

Test markdown conversion:

```bash
curl "https://downmark.fly.dev/markdown?q=https://example.com"
```

See full documentation inside the file for monitoring, troubleshooting, and scaling.
