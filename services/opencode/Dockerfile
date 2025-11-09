FROM oven/bun:1-alpine

WORKDIR /app

# Install OpenCode globally using bun
RUN bun add -g opencode-ai

# Expose OpenCode default port
EXPOSE 4096

# Start OpenCode server using bunx (handles binary architecture automatically)
# Using explicit host 0.0.0.0 to allow external connections within Docker network
CMD ["bunx", "opencode-ai", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
