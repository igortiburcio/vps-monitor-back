import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { DatabaseSetupService } from './database-setup.service.js';

/**
 * Módulo mínimo do setup: não sobe HTTP, auth nem o pool da aplicação.
 * O objetivo é rodar antes de o banco existir.
 */
@Module({ providers: [DatabaseSetupService] })
class SetupModule {}

const app = await NestFactory.createApplicationContext(SetupModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  await app.get(DatabaseSetupService).run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await app.close();
}
