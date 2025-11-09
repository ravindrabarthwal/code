# Better-Auth Integration for Proxy Service Implementation Plan

## Overview

Integrate better-auth authentication system into the proxy service to provide secure access control via Google OAuth with domain restrictions, API key generation for programmatic access, and middleware validation for the OpenCode proxy endpoints. The implementation will also reorganize the proxy service codebase for better maintainability.

## Current State Analysis

The proxy service currently:
- Uses a monolithic structure with all code in `services/proxy/src/index.ts`
- Has no authentication or authorization mechanisms
- Captures but doesn't validate API keys from URL paths (`/opencode/:apiKey/*`)
- Runs on Bun runtime with Hono framework
- Has placeholder routes at `/p8n/*` for future API endpoints
- Has no database integration

### Key Discoveries:
- Proxy service uses Hono framework which has built-in middleware support - `services/proxy/src/index.ts:1-3`
- The `:apiKey` parameter is already captured in routes but unused - `services/proxy/src/index.ts:22`
- Environment-based configuration is already in place - `services/proxy/src/index.ts:9-11`
- Docker Compose setup exists but lacks database service - `docker-compose.yml`

## Desired End State

After implementation, the proxy service will:
1. Authenticate users via Google OAuth with domain restrictions at `/p8n/auth/*`
2. Allow authenticated users to generate, list, and revoke API keys
3. Validate API keys in the `/opencode/:apiKey/*` path using fast middleware
4. Store sessions and API keys in a PostgreSQL database
5. Have a modular code structure with separated concerns
6. Support both browser-based (session) and programmatic (API key) access

### Verification Criteria:
- Users can log in with Google accounts from allowed domains only
- Users can generate API keys through a protected endpoint
- API keys in URLs are validated before proxying requests
- Invalid or expired API keys return 401 Unauthorized
- Code is organized into modules for auth, routes, middleware, and config

## What We're NOT Doing

- Building a full user management UI (only API endpoints)
- Implementing other OAuth providers besides Google
- Adding rate limiting per API key (can be added later)
- Creating a web-based dashboard for API key management
- Implementing user roles or permissions beyond basic authentication
- Adding metrics or analytics tracking

## Implementation Approach

We'll use an incremental approach, first setting up the authentication infrastructure, then adding API key management, and finally reorganizing the code. Each phase builds on the previous one and can be tested independently.

## Phase 1: Database & Authentication Infrastructure

### Overview
Set up PostgreSQL database, initialize better-auth with Google OAuth provider, and create basic auth configuration.

### Changes Required:

#### 1. Docker Compose Database Addition
**File**: `docker-compose.yml`
**Changes**: Add PostgreSQL service and update proxy environment

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: auth-db
    environment:
      - POSTGRES_DB=proxy_auth
      - POSTGRES_USER=proxy_user
      - POSTGRES_PASSWORD=proxy_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - opencode-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U proxy_user -d proxy_auth"]
      interval: 10s
      timeout: 5s
      retries: 5

  proxy:
    # ... existing config ...
    environment:
      # ... existing vars ...
      - DATABASE_URL=postgresql://proxy_user:proxy_password@postgres:5432/proxy_auth
      - BETTER_AUTH_SECRET=<generate-random-secret>
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - ALLOWED_DOMAINS=${ALLOWED_DOMAINS:-example.com}
      - BASE_URL=http://localhost:3000
    depends_on:
      postgres:
        condition: service_healthy
      opencode:
        condition: service_started

volumes:
  postgres-data:
  # ... existing volumes ...
```

#### 2. Package Dependencies
**File**: `services/proxy/package.json`
**Changes**: Add better-auth, Drizzle ORM, and database dependencies

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun src/lib/seed.ts"
  },
  "dependencies": {
    "hono": "^4.10.4",
    "better-auth": "^1.3.10",
    "drizzle-orm": "^0.34.0",
    "postgres": "^3.5.0",
    "@hono/node-server": "^1.14.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0",
    "drizzle-kit": "^0.25.0"
  }
}
```

#### 3. Environment Configuration
**File**: `services/proxy/.env.example`
**Changes**: Create environment template

```bash
# Database
DATABASE_URL=postgresql://proxy_user:proxy_password@localhost:5432/proxy_auth

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Domain restrictions (comma-separated)
ALLOWED_DOMAINS=example.com,company.com

# Base URL for callbacks
BASE_URL=http://localhost:3000
```

#### 4. Drizzle Schema Definition
**File**: `services/proxy/src/db/schema.ts`
**Changes**: Define database schema with Drizzle ORM

```typescript
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// User table
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Session table
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// Account table for OAuth providers
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

// Verification table
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// API Key table (added by better-auth plugin)
export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  lastUsedAt: timestamp("last_used_at"),
  metadata: text("metadata"),
});
```

#### 5. Database Connection Module
**File**: `services/proxy/src/db/index.ts`
**Changes**: Create Drizzle database connection

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create postgres connection
const queryClient = postgres(process.env.DATABASE_URL!);

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
```

#### 6. Auth Configuration Module
**File**: `services/proxy/src/lib/auth.ts`
**Changes**: Create better-auth configuration with Drizzle adapter

```typescript
import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BASE_URL || "http://localhost:3000",

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  plugins: [
    apiKey({
      prefix: "oc_", // opencode prefix
      enableSessionForAPIKeys: true,
      apiKeyHeaders: ["x-api-key", "authorization"],
      apiKeyGetter: (ctx) => {
        // Extract from header or URL path
        const headerKey = ctx.request.headers.get("x-api-key");
        if (headerKey) return headerKey;

        // Extract from URL path pattern /opencode/:apiKey/*
        const path = new URL(ctx.request.url).pathname;
        const match = path.match(/^\/opencode\/([^\/]+)/);
        return match ? match[1] : null;
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Custom user validation for domain restrictions
  hooks: {
    onRequest: async (request) => {
      // Domain validation will be added here
      return request;
    },
  },
});

export type Auth = typeof auth;
```

#### 7. Drizzle Configuration
**File**: `services/proxy/drizzle.config.ts`
**Changes**: Create Drizzle Kit configuration for migrations

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Database container starts successfully: `docker-compose up postgres`
- [ ] Dependencies install without conflicts: `bun install`
- [ ] Drizzle schema generates successfully: `bunx drizzle-kit generate`
- [ ] Database migrations apply cleanly: `bunx drizzle-kit migrate`
- [ ] Better-auth initialization doesn't throw errors: `bun run typecheck`
- [ ] Database connection test passes: `bun run test:db`

#### Manual Verification:
- [ ] PostgreSQL is accessible on the network
- [ ] Environment variables are properly loaded
- [ ] Database tables are created correctly
- [ ] Drizzle Studio shows correct schema: `bunx drizzle-kit studio`

---

## Phase 2: Authentication Routes & Domain Validation

### Overview
Implement authentication routes under `/p8n/auth/*`, add Google OAuth with domain restrictions, and create session management endpoints.

### Changes Required:

#### 1. Auth Routes Module
**File**: `services/proxy/src/routes/auth.ts`
**Changes**: Create authentication route handlers

```typescript
import { Hono } from 'hono';
import { auth } from '../lib/auth';
import { getCookie } from 'hono/cookie';

export const authRoutes = new Hono();

// Mount better-auth handlers
authRoutes.all('/*', async (c) => {
  const response = await auth.handler(c.req.raw);
  return response;
});

// Custom domain validation middleware
authRoutes.use('/sign-in/google', async (c, next) => {
  // This will be called before the OAuth flow
  await next();
});

// Session check endpoint
authRoutes.get('/session', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  return c.json(session);
});
```

#### 2. Domain Restriction Hook
**File**: `services/proxy/src/lib/auth.ts`
**Changes**: Add domain validation in auth configuration

```typescript
// Inside auth configuration, update hooks:
hooks: {
  after: [
    {
      matcher: (context) => context.path === "/sign-in/google/callback",
      handler: async (context) => {
        if (context.response?.status === 200 && context.body?.user?.email) {
          const email = context.body.user.email;
          const allowedDomains = (process.env.ALLOWED_DOMAINS || '').split(',');
          const emailDomain = email.split('@')[1];

          if (!allowedDomains.includes(emailDomain)) {
            // Delete the created user and session
            await auth.api.deleteUser({ userId: context.body.user.id });

            return new Response(
              JSON.stringify({
                error: 'Domain not allowed',
                message: `Email domain ${emailDomain} is not authorized`
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
        }
        return context.response;
      },
    },
  ],
},
```

#### 3. Update Main Application
**File**: `services/proxy/src/index.ts`
**Changes**: Mount auth routes

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { proxyRoutes } from './routes/proxy';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.BASE_URL || 'http://localhost:3000',
  credentials: true,
}));

// Mount routes
app.route('/p8n/auth', authRoutes);
app.route('/opencode', proxyRoutes);

// Health check
app.get('/p8n/health', (c) => {
  return c.json({ status: 'healthy' });
});

export default {
  port: parseInt(process.env.PROXY_PORT || '3000'),
  fetch: app.fetch,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] Auth routes respond correctly: `curl http://localhost:3000/p8n/auth/session`
- [ ] TypeScript compilation passes: `bun run typecheck`
- [ ] Unit tests for domain validation pass: `bun test auth.test.ts`

#### Manual Verification:
- [ ] Google OAuth flow redirects to Google sign-in
- [ ] Successful login with allowed domain email
- [ ] Rejection of non-allowed domain emails with proper error message
- [ ] Session cookie is set after successful authentication

---

## Phase 3: API Key Management

### Overview
Implement API key generation, listing, and revocation endpoints for authenticated users.

### Changes Required:

#### 1. API Key Routes
**File**: `services/proxy/src/routes/api-keys.ts`
**Changes**: Create API key management endpoints

```typescript
import { Hono } from 'hono';
import { auth } from '../lib/auth';
import { requireAuth } from '../middleware/auth';

export const apiKeyRoutes = new Hono();

// Require authentication for all API key routes
apiKeyRoutes.use('*', requireAuth);

// Create API key
apiKeyRoutes.post('/create', async (c) => {
  const body = await c.req.json();
  const session = c.get('session');

  const apiKey = await auth.api.createApiKey({
    body: {
      name: body.name || 'API Key',
      expiresIn: body.expiresIn || 60 * 60 * 24 * 365, // 1 year default
      userId: session.user.id,
      metadata: {
        createdAt: new Date().toISOString(),
        userEmail: session.user.email,
      },
    },
    headers: c.req.raw.headers,
  });

  return c.json(apiKey);
});

// List API keys
apiKeyRoutes.get('/list', async (c) => {
  const session = c.get('session');

  const keys = await auth.api.listApiKeys({
    query: { userId: session.user.id },
    headers: c.req.raw.headers,
  });

  // Don't return the actual key values
  const sanitized = keys.map(k => ({
    id: k.id,
    name: k.name,
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
    lastUsed: k.lastUsed,
  }));

  return c.json(sanitized);
});

// Revoke API key
apiKeyRoutes.delete('/:keyId', async (c) => {
  const keyId = c.req.param('keyId');
  const session = c.get('session');

  await auth.api.revokeApiKey({
    body: { id: keyId, userId: session.user.id },
    headers: c.req.raw.headers,
  });

  return c.json({ success: true });
});
```

#### 2. Auth Middleware
**File**: `services/proxy/src/middleware/auth.ts`
**Changes**: Create authentication middleware

```typescript
import { Context, Next } from 'hono';
import { auth } from '../lib/auth';

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  c.set('session', session);
  await next();
}
```

#### 3. Mount API Key Routes
**File**: `services/proxy/src/index.ts`
**Changes**: Add API key routes

```typescript
import { apiKeyRoutes } from './routes/api-keys';

// Add to route mounting section
app.route('/p8n/api-keys', apiKeyRoutes);
```

### Success Criteria:

#### Automated Verification:
- [ ] API key creation endpoint works: `curl -X POST http://localhost:3000/p8n/api-keys/create`
- [ ] API key listing endpoint works: `curl http://localhost:3000/p8n/api-keys/list`
- [ ] API key revocation endpoint works: `curl -X DELETE http://localhost:3000/p8n/api-keys/:id`
- [ ] TypeScript compilation passes: `bun run typecheck`

#### Manual Verification:
- [ ] Authenticated users can create API keys
- [ ] API keys are properly prefixed with "oc_"
- [ ] Users can only see and revoke their own API keys
- [ ] API key expiration is correctly set

---

## Phase 4: Proxy Route Integration with API Key Validation

### Overview
Integrate API key validation into the proxy routes and handle authentication errors properly.

### Changes Required:

#### 1. API Key Validation Middleware
**File**: `services/proxy/src/middleware/validate-api-key.ts`
**Changes**: Create fast API key validation middleware

```typescript
import { Context, Next } from 'hono';
import { auth } from '../lib/auth';

export async function validateApiKey(c: Context, next: Next) {
  const apiKey = c.req.param('apiKey');

  if (!apiKey || !apiKey.startsWith('oc_')) {
    return c.json({ error: 'Invalid API key format' }, 401);
  }

  try {
    // Verify API key and get session
    const session = await auth.api.getSession({
      headers: new Headers({
        'x-api-key': apiKey,
      }),
    });

    if (!session) {
      return c.json({ error: 'Invalid or expired API key' }, 401);
    }

    // Store session in context for downstream use
    c.set('apiKeySession', session);

    // Add user identifier to logs
    c.set('userId', session.user.id);

    await next();
  } catch (error) {
    console.error('API key validation error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}
```

#### 2. Refactored Proxy Routes
**File**: `services/proxy/src/routes/proxy.ts`
**Changes**: Create modular proxy routes with authentication

```typescript
import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { validateApiKey } from '../middleware/validate-api-key';

const OPENCODE_HOST = process.env.OPENCODE_HOST || 'opencode';
const OPENCODE_PORT = process.env.OPENCODE_PORT || '4096';

export const proxyRoutes = new Hono();

// Apply API key validation to all proxy routes
proxyRoutes.use('/:apiKey/*', validateApiKey);

// Proxy requests to OpenCode
proxyRoutes.all('/:apiKey/*', async (c) => {
  const path = c.req.path;
  const session = c.get('apiKeySession');

  // Extract path after /opencode/:apiKey/
  const splits = path.split('/');
  const openCodePath = splits.length > 3 ? splits.slice(3).join('/') : '';

  const opencodeUrl = `http://${OPENCODE_HOST}:${OPENCODE_PORT}/${openCodePath}`;

  // Add custom headers for OpenCode
  const headers = new Headers(c.req.raw.headers);
  headers.set('X-User-Id', session.user.id);
  headers.set('X-User-Email', session.user.email);

  const modifiedReq = new Request(c.req.raw.url, {
    method: c.req.raw.method,
    headers: headers,
    body: c.req.raw.body,
  });

  const response = await proxy(opencodeUrl, modifiedReq);

  // Log API usage (optional - for future analytics)
  console.log(`API Key Usage: ${session.user.email} -> ${opencodeUrl}`);

  return response;
});
```

#### 3. Error Handling Middleware
**File**: `services/proxy/src/middleware/error-handler.ts`
**Changes**: Add global error handling

```typescript
import { Context, Next } from 'hono';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Unhandled error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return c.json({ error: 'Authentication error', message: error.message }, 401);
      }

      if (error.message.includes('Database')) {
        return c.json({ error: 'Service temporarily unavailable' }, 503);
      }
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Valid API key allows proxy access: `curl http://localhost:3000/opencode/oc_valid_key/test`
- [ ] Invalid API key returns 401: `curl http://localhost:3000/opencode/invalid/test`
- [ ] Missing API key returns 401: `curl http://localhost:3000/opencode//test`
- [ ] User headers are forwarded to OpenCode: Check logs

#### Manual Verification:
- [ ] API key validation is fast (<50ms)
- [ ] Expired API keys are rejected
- [ ] Revoked API keys immediately stop working
- [ ] User context is properly passed to OpenCode

---

## Phase 5: Code Organization & Production Readiness

### Overview
Reorganize code structure, add proper configuration management, improve error handling, and add production optimizations.

### Changes Required:

#### 1. Configuration Module
**File**: `services/proxy/src/config/index.ts`
**Changes**: Centralize configuration

```typescript
import { z } from 'zod';

const configSchema = z.object({
  // Server
  port: z.string().default('3000').transform(Number),

  // Database
  databaseUrl: z.string().url(),

  // Auth
  betterAuthSecret: z.string().min(32),
  baseUrl: z.string().url(),

  // Google OAuth
  googleClientId: z.string(),
  googleClientSecret: z.string(),
  allowedDomains: z.string().transform(s => s.split(',')),

  // OpenCode
  opencodeHost: z.string().default('opencode'),
  opencodePort: z.string().default('4096'),

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = configSchema.parse({
  port: process.env.PROXY_PORT,
  databaseUrl: process.env.DATABASE_URL,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET,
  baseUrl: process.env.BASE_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  allowedDomains: process.env.ALLOWED_DOMAINS,
  opencodeHost: process.env.OPENCODE_HOST,
  opencodePort: process.env.OPENCODE_PORT,
  nodeEnv: process.env.NODE_ENV,
});

export type Config = typeof config;
```

#### 2. Database Migrations
**File**: `services/proxy/src/lib/migrate.ts`
**Changes**: Add migration runner with Drizzle

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations() {
  console.log('Running database migrations...');

  // Create a new client specifically for migrations
  const migrationClient = postgres(process.env.DATABASE_URL!, {
    max: 1, // Required for migrations
  });

  try {
    const db = drizzle(migrationClient);

    // Run Drizzle migrations
    await migrate(db, {
      migrationsFolder: './drizzle',
    });

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run migrations on startup in production
if (process.env.NODE_ENV === 'production') {
  runMigrations();
}
```

#### 3. Updated Project Structure
**File**: `services/proxy/src/index.ts`
**Changes**: Clean main entry point

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth';
import { apiKeyRoutes } from './routes/api-keys';
import { proxyRoutes } from './routes/proxy';
import { config } from './config';

const app = new Hono();

// Global middleware
app.use('*', errorHandler);
app.use('*', logger());
app.use('*', cors({
  origin: config.baseUrl,
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

// Mount routes
app.route('/p8n/auth', authRoutes);
app.route('/p8n/api-keys', apiKeyRoutes);
app.route('/opencode', proxyRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Export for Bun
export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`🚀 Proxy server starting on port ${config.port}`);
```

#### 4. Updated Dockerfile for Production
**File**: `services/proxy/Dockerfile`
**Changes**: Add production optimizations

```dockerfile
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Type check
RUN bun run typecheck

FROM oven/bun:1-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "start"]
```

### Success Criteria:

#### Automated Verification:
- [ ] All TypeScript files compile: `bun run typecheck`
- [ ] Configuration validates correctly: `bun test config.test.ts`
- [ ] All routes are accessible: `bun test integration.test.ts`
- [ ] Docker build succeeds: `docker build -t proxy-service .`
- [ ] Health check endpoint works: `curl http://localhost:3000/health`

#### Manual Verification:
- [ ] Service starts without errors in production mode
- [ ] All environment variables are properly validated
- [ ] Error messages don't leak sensitive information
- [ ] Logs are properly formatted and informative
- [ ] Service handles database connection failures gracefully

---

## Testing Strategy

### Unit Tests:
- Domain validation logic
- API key format validation
- Configuration parsing
- Middleware functions

### Integration Tests:
- Full OAuth flow with Google
- API key creation and validation flow
- Proxy request forwarding with authentication
- Session management

### Manual Testing Steps:
1. Start services: `docker-compose up`
2. Navigate to `http://localhost:3000/p8n/auth/sign-in/google`
3. Sign in with allowed domain email
4. Create API key via `POST /p8n/api-keys/create`
5. Use API key in proxy URL: `/opencode/{api_key}/test`
6. Verify request is forwarded to OpenCode
7. Revoke API key and verify access is denied

## Performance Considerations

- API key validation is cached in memory for 5 minutes
- Session cookies are cached to reduce database lookups
- Database connection pooling is configured for production
- Health checks don't query database to avoid overhead

## Migration Notes

- Run `bun run db:generate` to create migration files from Drizzle schema
- Run `bun run db:migrate` to apply migrations to the database
- Use `bun run db:studio` to inspect database tables via Drizzle Studio
- Better-auth tables are created through Drizzle schema definitions
- Existing proxy routes remain functional during migration
- API keys can be pre-generated for existing integrations
- Gradual rollout possible with feature flags

## References

- Better-auth documentation: https://better-auth.com/docs
- Drizzle ORM documentation: https://orm.drizzle.team/docs
- Hono middleware guide: https://hono.dev/guides/middleware
- Google OAuth setup: https://console.cloud.google.com/apis/credentials
- Better-auth Drizzle adapter: https://better-auth.com/docs/adapters/drizzle