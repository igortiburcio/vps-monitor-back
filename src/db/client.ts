import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../config/env.js';
import * as schema from './schema.js';

/**
 * Pool único do processo. `max` baixo porque a API roda em uma VPS
 * compartilhada com outros projetos.
 */
export const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => undefined,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
