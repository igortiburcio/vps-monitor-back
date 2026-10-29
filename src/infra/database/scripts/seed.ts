import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ApplicationModule } from '../../../application/application.module.js';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case.js';
import { env } from '../../config/env.js';
import { InfraModule } from '../../infra.module.js';
import { client } from '../client.js';

@Module({ imports: [InfraModule, ApplicationModule] })
class SeedModule {}

const email = env.SEED_EMAIL;
const password = env.SEED_PASSWORD;

if (!email || !password) {
  console.error('SEED_EMAIL e SEED_PASSWORD são obrigatórios');
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });

  try {
    const result = await app.get(CreateUserUseCase).execute({
      name: 'Admin',
      email,
      password,
    });

    console.log(
      result.created ? `Usuário ${email} criado.` : `Usuário ${email} já existe — nada a fazer.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await app.close();
    await client.end({ timeout: 5 });
  }
}
