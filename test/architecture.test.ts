import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'bun:test';

const SRC = resolve(import.meta.dirname, '../src');

function filesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    return statSync(path).isDirectory() ? filesIn(path) : path.endsWith('.ts') ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const content = readFileSync(file, 'utf8');

  return [...content.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
}

const FRAMEWORKS = /(@nestjs|drizzle-orm|fastify|^better-auth|@langchain|postgres)/;
/**
 * Application pode usar `@Injectable` (DI do Nest), mas não tecnologia de I/O.
 * `@thallesp/nestjs-better-auth` fica de fora: são decorators usados no HTTP.
 */
const TECH = /(drizzle-orm|fastify|^better-auth|@langchain|postgres)/;

function assertNoForbiddenImport(layer: string, forbidden: RegExp, forbiddenPaths: string[]): void {
  const violations: string[] = [];

  for (const file of filesIn(join(SRC, layer))) {
    for (const specifier of importsOf(file)) {
      const relative = file.replace(`${SRC}/`, '');

      if (forbidden.test(specifier) || forbiddenPaths.some((path) => specifier.includes(path))) {
        violations.push(`${relative} → ${specifier}`);
      }
    }
  }

  expect(violations).toEqual([]);
}

describe('regras de dependência entre camadas', () => {
  it('domain não depende de framework, infra, application ou http', () => {
    assertNoForbiddenImport('domain', FRAMEWORKS, ['/infra/', '/application/', '/http/']);
  });

  it('application não depende de infra, http nem de tecnologia', () => {
    assertNoForbiddenImport('application', TECH, ['/infra/', '/http/']);
  });

  it('http não importa infra diretamente (só application e domain)', () => {
    // `*.module.ts` são wiring (composition), não camada de entrada:
    // o HttpModule precisa importar o AiModule para registrar o controller do chat.
    const violations: string[] = [];

    for (const file of filesIn(join(SRC, 'http'))) {
      if (file.endsWith('.module.ts')) continue;

      for (const specifier of importsOf(file)) {
        if (
          /(drizzle-orm|@langchain|^better-auth)/.test(specifier) ||
          specifier.includes('/infra/')
        ) {
          violations.push(`${file.replace(`${SRC}/`, '')} → ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
