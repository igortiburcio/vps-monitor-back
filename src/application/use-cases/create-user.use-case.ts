import { Injectable } from '@nestjs/common';

import { InvalidUserDataError } from '../../domain/errors/domain.errors.js';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port.js';

export interface CreateUserCommand {
  name: string;
  email: string;
  password: string;
}

export type CreateUserResult = { created: false } | { created: true; id: string };

const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    const email = command.email.trim().toLowerCase();
    const name = command.name.trim();

    if (!name) throw new InvalidUserDataError('nome é obrigatório');
    if (!email.includes('@')) throw new InvalidUserDataError('e-mail inválido');
    if (command.password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidUserDataError(
        `a senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    }

    if (await this.users.existsByEmail(email)) {
      return { created: false };
    }

    const { id } = await this.users.create({ name, email, password: command.password });

    return { created: true, id };
  }
}
