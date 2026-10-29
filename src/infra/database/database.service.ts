import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import { client, db } from './client.js';

/**
 * Expõe o pool e a instância Drizzle pelo container de DI
 * e fecha a conexão no shutdown.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db = db;
  readonly client = client;

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
