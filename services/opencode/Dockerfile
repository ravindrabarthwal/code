FROM --platform=linux/amd64 oven/bun:1-alpine

WORKDIR /app

# Install OpenCode globally using bun
RUN bun add -g opencode-ai

# Expose OpenCode default port
EXPOSE 4096

# Start OpenCode server
# Using explicit host 0.0.0.0 to allow external connections within Docker network
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
