import { defineConfig } from 'drizzle-kit';

import { env } from './src/infra/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
