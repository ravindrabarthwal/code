FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose proxy port
EXPOSE 3000

# Start the proxy server
CMD ["bun", "run", "start"]
