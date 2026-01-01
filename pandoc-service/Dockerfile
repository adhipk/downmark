# Lightweight Pandoc Service Dockerfile
FROM oven/bun:1-debian AS base

# Install pandoc
RUN apt-get update && apt-get install -y \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy server file
COPY server.ts ./

# Expose port
EXPOSE 3001

# Run the server
CMD ["bun", "run", "server.ts"]
