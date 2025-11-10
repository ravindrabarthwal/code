import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "../db";
import { config } from "../config";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  secret: config.betterAuthSecret,
  baseURL: config.baseUrl,

  socialProviders: {
    google: {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    },
  },

  plugins: [
    apiKey(),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Validate email domain before user creation
          if (user.email) {
            const allowedDomains = config.allowedDomains.map(d => d.trim()).filter(Boolean);

            // If no domains configured, allow all
            if (allowedDomains.length === 0) {
              return { data: user };
            }

            const emailDomain = user.email.split('@')[1];

            if (!allowedDomains.includes(emailDomain)) {
              throw new APIError("BAD_REQUEST", {
                message: `Email domain ${emailDomain} is not authorized. Allowed domains: ${allowedDomains.join(', ')}`
              });
            }
          }

          return { data: user };
        },
      },
    },
  },
});

export type Auth = typeof auth;
