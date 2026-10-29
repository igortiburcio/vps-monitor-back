import { randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { client, db } from './client.js';
import { account, user } from './schema.js';

/**
 * Cria um usuário do app.
 *
 *   bun run create:user --email a@b.com --password 'segredo' [--name "Nome"]
 *
 * Idempotente: se o e-mail já existir, não faz nada.
 */
const argsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'a senha precisa de pelo menos 8 caracteres'),
  name: z.string().min(1).default('Admin'),
});

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

async function main(): Promise<void> {
  const parsed = argsSchema.safeParse(readArgs(process.argv.slice(2)));

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    console.error(`Argumentos inválidos:\n  ${issues.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }

  const { email, password, name } = parsed.data;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) {
    console.log(`Usuário ${email} já existe — nada a fazer.`);
    return;
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id: userId, name, email, emailVerified: true });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
    });
  });

  console.log(`Usuário ${email} criado.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
