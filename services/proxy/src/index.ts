import { Hono } from 'hono';
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
