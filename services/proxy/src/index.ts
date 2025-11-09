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

app.all('/p8n/*', async (c) => {
  return c.json({ message: 'healthy' });
});


// Proxy all /api/opencode/* requests to OpenCode server
app.all('/opencode/:apiKey/*',  async (c) => {
  const path = c.req.path;
  const splits = path.split('/');
  const openCodePath =  splits.length > 2 ? splits.slice(3).join('/') : '';

  const opencodeUrl = `http://${OPENCODE_HOST}:${OPENCODE_PORT}/${openCodePath}`;
  const res = await proxy(
    opencodeUrl,
      c.req,
  )
  return res
});

export default {
  port: parseInt(PROXY_PORT),
  fetch: app.fetch,
};
