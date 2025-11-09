import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { proxy } from 'hono/proxy'

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
app.all('/api/opencode/:path', async (c) => {
  const res = await proxy(
    `http://${OPENCODE_HOST}:${OPENCODE_PORT}/${c.req.param('path')}`,
    {
      headers: {
        ...c.req.header(), // optional, specify only when forwarding all the request data (including credentials) is necessary.
        'X-Forwarded-For': '127.0.0.1',
        'X-Forwarded-Host': c.req.header('host'),
        Authorization: undefined, // do not propagate request headers contained in c.req.header('Authorization')
      },
    }
  )
  res.headers.delete('Set-Cookie')
  return res
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
