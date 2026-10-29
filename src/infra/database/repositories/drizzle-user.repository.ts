import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';

import {
  type CreateUserInput,
  UserRepositoryPort,
} from '../../../domain/ports/user-repository.port.js';
import { DatabaseService } from '../database.service.js';
import { account, user } from '../schema.js';

@Injectable()
export class DrizzleUserRepository extends UserRepositoryPort {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async existsByEmail(email: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return Boolean(row);
  }

  /** O hash da senha é responsabilidade do adapter (infra), não do caso de uso. */
  async create(input: CreateUserInput): Promise<{ id: string }> {
    const userId = randomUUID();
    const passwordHash = await hashPassword(input.password);

    await this.database.db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: input.name,
        email: input.email,
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

    return { id: userId };
  }
}
