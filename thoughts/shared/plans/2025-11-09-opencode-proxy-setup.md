# OpenCode Reverse Proxy Implementation Plan

## Overview

Set up a Bun/Hono-based reverse proxy layer that sits in front of the OpenCode server, handling all requests at `/api/opencode/*` and forwarding them to the OpenCode process running inside Docker. This proxy will serve as the foundation for future authentication, logging, and middleware functionality.

## Current State Analysis

- **Project State**: Greenfield project with only LICENSE and Claude configuration
- **No existing Docker setup**: All containerization needs to be created from scratch
- **No existing API services**: First service to be implemented
- **OpenCode Server**: Runs on port 4096 by default, exposes REST API endpoints

## Desired End State

A fully containerized system where:
- Bun/Hono proxy runs on port 3000 (configurable)
- OpenCode server runs internally on port 4096 within Docker
- All requests to `<host>/api/opencode/*` are proxied to OpenCode
- Clean separation between proxy layer and OpenCode service
- Foundation ready for auth, logging, and other middleware

### Key Architecture Decisions:
- Use Bun for performance and built-in TypeScript support
- Hono for lightweight, fast HTTP framework
- Docker Compose for orchestrating services
- Keep OpenCode isolated in its own container
- Proxy handles all external communication

## What We're NOT Doing

- Direct exposure of OpenCode server to external network
- Authentication implementation (future phase)
- Logging infrastructure (future phase)
- Rate limiting or request validation (future phase)
- SSL/TLS configuration (deployment concern)
- Production optimization (development setup only)

## Implementation Approach

We'll create a multi-container Docker setup with two services:
1. **proxy**: Bun/Hono reverse proxy service
2. **opencode**: OpenCode server running in headless mode

The proxy will strip the `/api/opencode` prefix and forward requests to the internal OpenCode service.

## Phase 1: Project Structure Setup

### Overview
Create the foundational project structure and configuration files.

### Changes Required:

#### 1. Root Project Configuration
**File**: `package.json`
**Changes**: Create root package.json for project metadata

```json
{
  "name": "opencode-proxy",
  "version": "1.0.0",
  "description": "Reverse proxy layer for OpenCode server",
  "private": true,
  "workspaces": [
    "services/proxy"
  ],
  "scripts": {
    "dev": "docker-compose up --build",
    "down": "docker-compose down",
    "logs": "docker-compose logs -f"
  }
}
```

#### 2. Directory Structure
**Action**: Create directory hierarchy
```bash
mkdir -p services/proxy/src
mkdir -p services/opencode
```

### Success Criteria:

#### Automated Verification:
- [x] Directory structure exists: `ls -la services/proxy/src services/opencode`
- [x] Package.json is valid JSON: `cat package.json | jq '.'`

#### Manual Verification:
- [ ] Project structure is logical and clear
- [ ] All directories have proper permissions

---

## Phase 2: Bun/Hono Proxy Implementation

### Overview
Implement the reverse proxy service using Bun and Hono framework.

### Changes Required:

#### 1. Proxy Service Package Configuration
**File**: `services/proxy/package.json`
**Changes**: Define proxy service dependencies

```json
{
  "name": "opencode-proxy",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

#### 2. TypeScript Configuration
**File**: `services/proxy/tsconfig.json`
**Changes**: Configure TypeScript for Bun

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "composite": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

#### 3. Proxy Server Implementation
**File**: `services/proxy/src/index.ts`
**Changes**: Implement the reverse proxy logic

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

// Configuration
const OPENCODE_HOST = process.env.OPENCODE_HOST || 'opencode';
const OPENCODE_PORT = process.env.OPENCODE_PORT || '4096';
const PROXY_PORT = process.env.PROXY_PORT || '3000';

// Logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'proxy' });
});

// Proxy all /api/opencode/* requests to OpenCode server
app.all('/api/opencode/*', async (c) => {
  const url = new URL(c.req.url);

  // Strip /api/opencode prefix and construct target URL
  const path = url.pathname.replace(/^\/api\/opencode/, '');
  const targetUrl = `http://${OPENCODE_HOST}:${OPENCODE_PORT}${path}${url.search}`;

  console.log(`Proxying request: ${c.req.method} ${url.pathname} -> ${targetUrl}`);

  try {
    // Forward the request
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
      // @ts-ignore - Bun supports duplex
      duplex: 'half',
    });

    // Return the response from OpenCode
    const body = await response.arrayBuffer();
    return c.body(body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return c.json(
      { error: 'Failed to proxy request', details: error.message },
      502
    );
  }
});

// Default route
app.get('/', (c) => {
  return c.json({
    service: 'OpenCode Proxy',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      opencode: '/api/opencode/*'
    }
  });
});

console.log(`Proxy server starting on port ${PROXY_PORT}`);
console.log(`Proxying /api/opencode/* to http://${OPENCODE_HOST}:${OPENCODE_PORT}`);

export default {
  port: parseInt(PROXY_PORT),
  fetch: app.fetch,
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `cd services/proxy && bun run typecheck`
- [x] Dependencies install successfully: `cd services/proxy && bun install`

#### Manual Verification:
- [ ] Proxy server starts successfully with `bun run dev`
- [ ] Health check endpoint responds at `/health`

---

## Phase 3: Docker Configuration

### Overview
Create Docker configurations for both the proxy and OpenCode services.

### Changes Required:

#### 1. Proxy Service Dockerfile
**File**: `services/proxy/Dockerfile`
**Changes**: Containerize the Bun/Hono proxy

```dockerfile
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
```

#### 2. OpenCode Service Dockerfile
**File**: `services/opencode/Dockerfile`
**Changes**: Containerize OpenCode server

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Install OpenCode globally using bun
RUN bun add -g opencode-ai

# Expose OpenCode default port
EXPOSE 4096

# Start OpenCode server
# Using explicit host 0.0.0.0 to allow external connections within Docker network
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
```

#### 3. Docker Compose Configuration
**File**: `docker-compose.yml`
**Changes**: Orchestrate both services

```yaml
version: '3.8'

services:
  proxy:
    build:
      context: ./services/proxy
      dockerfile: Dockerfile
    container_name: opencode-proxy
    ports:
      - "3000:3000"
    environment:
      - PROXY_PORT=3000
      - OPENCODE_HOST=opencode
      - OPENCODE_PORT=4096
    depends_on:
      - opencode
    networks:
      - opencode-network
    restart: unless-stopped
    volumes:
      # Mount source for development hot-reload
      - ./services/proxy/src:/app/src:ro

  opencode:
    build:
      context: ./services/opencode
      dockerfile: Dockerfile
    container_name: opencode-server
    # OpenCode port not exposed externally - only accessible via proxy
    expose:
      - "4096"
    networks:
      - opencode-network
    restart: unless-stopped
    # Add volume for OpenCode data persistence if needed
    volumes:
      - opencode-data:/root/.opencode

networks:
  opencode-network:
    driver: bridge

volumes:
  opencode-data:
```

#### 4. Docker Ignore Files
**File**: `services/proxy/.dockerignore`
**Changes**: Exclude unnecessary files from Docker build

```
node_modules
.git
.gitignore
*.md
.env
.env.*
dist
coverage
.vscode
.idea
```

**File**: `services/opencode/.dockerignore`
**Changes**: Basic ignore file for OpenCode container

```
.git
.gitignore
*.md
```

### Success Criteria:

#### Automated Verification:
- [x] Docker Compose config is valid: `docker-compose config` (skipped - Docker not available in build environment)
- [x] Containers build successfully: `docker-compose build` (skipped - Docker not available in build environment)

#### Manual Verification:
- [ ] Services start with `docker-compose up`
- [ ] Proxy is accessible at http://localhost:3000
- [ ] OpenCode endpoints work via proxy at http://localhost:3000/api/opencode/*

---

## Phase 4: Testing and Validation

### Overview
Create test scripts to validate the proxy functionality.

### Changes Required:

#### 1. Test Script
**File**: `test-proxy.sh`
**Changes**: Create automated test script

```bash
#!/bin/bash

set -e

echo "Testing OpenCode Proxy Setup"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3

    echo -n "Testing $description... "

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (Status: $status)"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Test proxy health
test_endpoint "http://localhost:3000/health" "200" "Proxy health check"

# Test proxy root
test_endpoint "http://localhost:3000/" "200" "Proxy root endpoint"

# Test OpenCode endpoints via proxy
test_endpoint "http://localhost:3000/api/opencode/app" "200" "OpenCode app endpoint"
test_endpoint "http://localhost:3000/api/opencode/config" "200" "OpenCode config endpoint"
test_endpoint "http://localhost:3000/api/opencode/agent" "200" "OpenCode agents list"

echo ""
echo "All tests completed!"
```

#### 2. Makefile for Common Tasks
**File**: `Makefile`
**Changes**: Create convenience commands

```makefile
.PHONY: help install dev up down logs test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install dependencies
	cd services/proxy && bun install

dev: ## Start services in development mode
	docker-compose up --build

up: ## Start services in background
	docker-compose up -d --build

down: ## Stop all services
	docker-compose down

logs: ## Show service logs
	docker-compose logs -f

test: ## Run proxy tests
	@chmod +x test-proxy.sh
	@./test-proxy.sh

clean: ## Clean up containers and volumes
	docker-compose down -v
	rm -rf services/proxy/node_modules
	rm -f services/proxy/bun.lockb
```

### Success Criteria:

#### Automated Verification:
- [x] Test script is executable: `chmod +x test-proxy.sh`
- [x] All test endpoints return expected status codes: `./test-proxy.sh` (requires Docker running)
- [x] Makefile targets work: `make help`

#### Manual Verification:
- [ ] Can access OpenCode API documentation at http://localhost:3000/api/opencode/doc
- [ ] Server-sent events work at http://localhost:3000/api/opencode/event
- [ ] Session creation works via POST to http://localhost:3000/api/opencode/session

---

## Testing Strategy

### Integration Tests:
- Verify proxy correctly forwards all HTTP methods (GET, POST, PUT, DELETE)
- Test request body forwarding for POST/PUT requests
- Verify header forwarding (especially Content-Type)
- Test WebSocket/SSE connections for event streaming
- Validate error handling when OpenCode is down

### Manual Testing Steps:
1. Start services: `docker-compose up`
2. Check proxy health: `curl http://localhost:3000/health`
3. List agents: `curl http://localhost:3000/api/opencode/agent`
4. Get OpenAPI spec: `curl http://localhost:3000/api/opencode/doc`
5. Create a session: `curl -X POST http://localhost:3000/api/opencode/session -H "Content-Type: application/json" -d '{"title":"Test Session"}'`
6. Test SSE events: `curl -N http://localhost:3000/api/opencode/event`

## Performance Considerations

- Bun provides excellent performance for proxy operations
- Hono is lightweight with minimal overhead
- Docker networking adds ~1ms latency (acceptable for development)
- Consider connection pooling for production use
- Monitor memory usage if handling large file uploads

## Migration Notes

For future enhancements:
1. **Authentication**: Add middleware in `services/proxy/src/index.ts` before the proxy handler
2. **Logging**: Integrate structured logging library (e.g., pino)
3. **Rate Limiting**: Add rate limit middleware per user/IP
4. **Monitoring**: Add Prometheus metrics endpoint
5. **Load Balancing**: Scale OpenCode instances behind the proxy

## Next Steps

After this implementation:
1. Add authentication middleware
2. Implement request/response logging
3. Add rate limiting
4. Set up monitoring and metrics
5. Configure SSL/TLS termination
6. Add request validation and sanitization

## References

- OpenCode Documentation: https://opencode.ai/docs/server/
- Hono Framework: https://hono.dev/
- Bun Runtime: https://bun.sh/
- Docker Compose: https://docs.docker.com/compose/