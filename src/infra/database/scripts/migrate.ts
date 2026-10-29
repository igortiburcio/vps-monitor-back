import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '../../config/env.js';

/**
 * Aplica as migrations em `./drizzle` usando DATABASE_URL.
 * Usado pelo `db:setup` e pelo entrypoint do container.
 */
export async function runMigrations(databaseUrl: string = env.DATABASE_URL): Promise<void> {
  // scripts -> database -> infra -> src -> /app
  const migrationsFolder = resolve(import.meta.dirname, '../../../../drizzle');

  if (!existsSync(migrationsFolder)) {
    throw new Error('Pasta drizzle/ não encontrada. Rode `bun run db:generate` primeiro.');
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (import.meta.main) {
  await runMigrations();
  console.log('migrations aplicadas');
}
