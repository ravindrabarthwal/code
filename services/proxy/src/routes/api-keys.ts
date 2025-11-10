import { Hono } from 'hono';
import { auth } from '../lib/auth';
import { requireAuth } from '../middleware/auth';

type SessionContext = {
  Variables: {
    session: Awaited<ReturnType<typeof auth.api.getSession>>;
  };
};

export const apiKeyRoutes = new Hono<SessionContext>();

// Require authentication for all API key routes
apiKeyRoutes.use('*', requireAuth);

// Create API key
apiKeyRoutes.post('/create', async (c) => {
  const body = await c.req.json();
  const session = c.get('session');

  if (!session) {
    return c.json({ error: 'Authentication required' }, 401);
  }

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
  const keys = await auth.api.listApiKeys({
    headers: c.req.raw.headers,
  });

  // Don't return the actual key values
  const sanitized = keys.map(k => ({
    id: k.id,
    name: k.name,
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
    updatedAt: k.updatedAt,
  }));

  return c.json(sanitized);
});

// Revoke API key
apiKeyRoutes.delete('/:keyId', async (c) => {
  const keyId = c.req.param('keyId');

  await auth.api.deleteApiKey({
    body: { keyId },
    headers: c.req.raw.headers,
  });

  return c.json({ success: true });
});
