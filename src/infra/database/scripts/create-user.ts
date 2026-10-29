import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ApplicationModule } from '../../../application/application.module.js';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case.js';
import { InfraModule } from '../../infra.module.js';
import { client } from '../client.js';

/** Módulo de CLI: reaproveita os mesmos casos de uso da API. */
@Module({ imports: [InfraModule, ApplicationModule] })
class CliModule {}

function readArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value && !value.startsWith('--')) {
      result[key] = value;
      index += 1;
    }
  }

  return result;
}

const args = readArgs(process.argv.slice(2));
const email = args.email;
const password = args.password;
const name = args.name ?? 'Admin';

if (!email || !password) {
  console.error('Uso: bun run create:user --email <email> --password <senha> [--name "Nome"]');
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });

  try {
    const result = await app.get(CreateUserUseCase).execute({ name, email, password });

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
