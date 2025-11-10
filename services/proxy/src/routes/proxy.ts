import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { validateApiKey } from '../middleware/validate-api-key';
import { auth } from '../lib/auth';
import { config } from '../config';

type ApiKeyContext = {
  Variables: {
    apiKeySession: Awaited<ReturnType<typeof auth.api.getSession>>;
    userId: string;
  };
};

export const proxyRoutes = new Hono<ApiKeyContext>();

// Apply API key validation to all proxy routes
// proxyRoutes.use('/:apiKey/*', validateApiKey);

// Proxy requests to OpenCode
proxyRoutes.all('/:apiKey/*', async (c) => {
  const path = c.req.path;
  const session = c.get('apiKeySession');

  // if (!session) {
  //   return c.json({ error: 'Authentication required' }, 401);
  // }

  // Extract path after /opencode/:apiKey/
  const splits = path.split('/');
  const openCodePath = splits.length > 3 ? splits.slice(3).join('/') : '';

  const opencodeUrl = `http://${config.opencodeHost}:${config.opencodePort}/${openCodePath}`;

  return await proxy(opencodeUrl, c.req);
});
