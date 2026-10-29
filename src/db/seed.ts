import { randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { client, db } from './client.js';
import { account, user } from './schema.js';

/**
 * Cria o usuário único do app.
 * Idempotente e compatível com `disableSignUp: true` — insere direto
 * em user/account com a senha hasheada pelo próprio Better Auth.
 */
async function seed(): Promise<void> {
  const email = env.SEED_EMAIL;
  const password = env.SEED_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_EMAIL e SEED_PASSWORD são obrigatórios');
  }

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
    await tx.insert(user).values({
      id: userId,
      name: 'Admin',
      email,
      emailVerified: true,
    });

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
  await seed();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
