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
