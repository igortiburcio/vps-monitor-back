import { Injectable, Logger } from '@nestjs/common';
import postgres from 'postgres';

import { env } from '../../config/env.js';
import { runMigrations } from './migrate.js';

/** Escapa um identificador SQL (role, database). */
function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Escapa um literal SQL (senha). */
function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

type Connection = ReturnType<typeof postgres>;

@Injectable()
export class DatabaseSetupService {
  private readonly logger = new Logger('DatabaseSetup');

  async run(): Promise<void> {
    const adminUrl = env.DATABASE_ADMIN_URL;
    if (!adminUrl) {
      throw new Error('DATABASE_ADMIN_URL é obrigatória para rodar o db:setup');
    }

    const target = new URL(env.DATABASE_URL);
    const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
    const role = decodeURIComponent(target.username);
    const password = decodeURIComponent(target.password);

    if (!databaseName || !role) {
      throw new Error('DATABASE_URL precisa ter usuário e nome do banco');
    }

    const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });

    try {
      await this.ensureRole(admin, role, password);
      await this.ensureDatabase(admin, databaseName, role);
    } finally {
      await admin.end({ timeout: 5 });
    }

    this.logger.log('aplicando migrations...');
    await runMigrations();
    this.logger.log('migrations aplicadas');
  }

  private async ensureRole(admin: Connection, role: string, password: string): Promise<void> {
    const [row] = await admin<{ exists: boolean }[]>`
      select exists (select 1 from pg_roles where rolname = ${role}) as exists
    `;

    if (row?.exists) {
      this.logger.log(`role "${role}" já existe`);
      return;
    }

    // CREATE ROLE não aceita parâmetros em identificador: interpolar com escape.
    await admin.unsafe(`create role ${quoteIdent(role)} login password ${quoteLiteral(password)}`);
    this.logger.log(`role "${role}" criada`);
  }

  private async ensureDatabase(admin: Connection, name: string, owner: string): Promise<void> {
    const [row] = await admin<{ exists: boolean }[]>`
      select exists (select 1 from pg_database where datname = ${name}) as exists
    `;

    if (row?.exists) {
      this.logger.log(`database "${name}" já existe`);
      return;
    }

    // CREATE DATABASE não pode rodar dentro de bloco de transação.
    await admin.unsafe(`create database ${quoteIdent(name)} owner ${quoteIdent(owner)}`);
    this.logger.log(`database "${name}" criado (owner: ${owner})`);
  }
}
