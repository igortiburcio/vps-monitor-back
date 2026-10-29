import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { allowedOrigins, env } from '../config/env.js';
import { db } from '../database/client.js';
import * as schema from '../database/schema.js';

export const auth = betterAuth({
  appName: 'VPS Monitor',
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    // App pessoal: o único usuário é criado por `bun run seed:user`.
    disableSignUp: true,
    requireEmailVerification: false,
  },

  // Permite autenticar com Authorization: Bearer (usado pelo app React Native)
  plugins: [bearer()],

  trustedOrigins: allowedOrigins,

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    // Em produção o TLS termina no Cloudflare/Traefik
    useSecureCookies: env.NODE_ENV === 'production',
  },
});

export type Auth = typeof auth;
