# Deployment Guide

This guide covers deploying Downmark to various hosting platforms.

## Prerequisites

- Docker installed on your machine
- Git repository (for some platforms)
- Account on your chosen hosting platform

## Quick Start with Docker

### Local Testing

```bash
# Build the image
docker build -t downmark .

# Run the container
docker run -p 3000:3000 downmark

# Or use docker-compose
docker-compose up
```

Visit `http://localhost:3000` to test.

## Deployment Options

### 1. Fly.io (Recommended for Puppeteer apps)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app (follow prompts)
fly launch

# Deploy
fly deploy
```

**fly.toml** configuration:
```toml
app = "your-app-name"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### 2. Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

Set environment variables in Railway dashboard:
- `PORT`: 3000
- `HOST`: 0.0.0.0

### 3. DigitalOcean App Platform

1. Push code to GitHub/GitLab
2. Go to DigitalOcean → Apps → Create App
3. Connect your repository
4. Select "Dockerfile" as build method
5. Set environment variables:
   - `PORT`: 8080
   - `HOST`: 0.0.0.0
6. Deploy

### 4. AWS ECS (Elastic Container Service)

```bash
# Build and tag image
docker build -t downmark .
docker tag downmark:latest YOUR_AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/downmark:latest

# Push to ECR
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker push YOUR_AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/downmark:latest

# Create ECS task definition and service via AWS Console or CLI
```

### 5. Google Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/downmark

# Deploy to Cloud Run
gcloud run deploy downmark \
  --image gcr.io/YOUR_PROJECT_ID/downmark \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --allow-unauthenticated
```

### 6. Self-Hosted VPS (Ubuntu/Debian)

```bash
# On your server
git clone your-repo.git
cd your-repo

# Install Docker if not already installed
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Run with docker-compose
docker-compose up -d

# Or run directly
docker build -t downmark .
docker run -d -p 80:3000 --restart unless-stopped downmark
```

**With nginx reverse proxy:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Port the server listens on |
| `HOST` | 0.0.0.0 | Host the server binds to |
| `NODE_ENV` | development | Environment mode |

## Resource Requirements

**Minimum:**
- 1 CPU core
- 1 GB RAM
- 1 GB disk space

**Recommended:**
- 2 CPU cores
- 2 GB RAM
- 2 GB disk space

**Note:** Chrome/Puppeteer is memory-intensive. Allocate at least 2 GB RAM for production use.

## Health Check Endpoint

Add a health check endpoint to `server.ts`:

```typescript
"/health": {
  GET: () => new Response("OK", { status: 200 })
}
```

Use this for platform health checks:
- **Fly.io**: `/health`
- **Railway**: `/health`
- **Cloud Run**: `/health`

## Troubleshooting

### Chrome fails to launch
- Increase memory allocation (min 2 GB)
- Increase shared memory: `shm_size: '2gb'` in docker-compose

### Slow performance
- Enable browser instance reuse (already implemented)
- Increase CPU allocation
- Use faster network for asset loading

### Container crashes
- Check logs: `docker logs container-id`
- Increase memory limits
- Check Chrome dependencies are installed

## Security Considerations

1. **Rate limiting**: Add rate limiting to prevent abuse
2. **Input validation**: Validate URLs before processing
3. **Timeouts**: Already implemented (30s page load timeout)
4. **Resource limits**: Set CPU/memory limits in production
5. **HTTPS**: Use platform's built-in SSL or add nginx with Let's Encrypt

## Cost Estimates

- **Fly.io**: Free tier available, ~$5-10/month production
- **Railway**: $5/month credit, ~$10-20/month production
- **DigitalOcean**: $12-24/month (2 GB droplet)
- **AWS ECS**: $15-30/month (Fargate)
- **Google Cloud Run**: Pay per use, ~$10-20/month
- **Self-hosted VPS**: $5-12/month (DigitalOcean, Linode, Vultr)

## Monitoring

Recommended monitoring setup:
- **Logs**: Platform-specific logging (Fly.io logs, Railway logs, etc.)
- **Metrics**: CPU, memory, request rate
- **Uptime**: UptimeRobot, Pingdom, or platform health checks
- **Error tracking**: Sentry, LogRocket, or similar

## Scaling

For high traffic:
1. Horizontal scaling: Run multiple container instances
2. Load balancing: Platform handles this automatically
3. Browser pooling: Reuse browser instances (already implemented)
4. Caching: Add Redis for frequently requested URLs
