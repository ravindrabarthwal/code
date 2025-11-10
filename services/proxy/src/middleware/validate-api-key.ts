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
