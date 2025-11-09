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
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      { error: 'Failed to proxy request', details: errorMessage },
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
