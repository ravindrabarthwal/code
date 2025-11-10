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
