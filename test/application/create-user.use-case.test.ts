import { describe, expect, it } from 'bun:test';

import { CreateUserUseCase } from '../../src/application/use-cases/create-user.use-case.js';
import { InvalidUserDataError } from '../../src/domain/errors/domain.errors.js';
import { InMemoryUserRepository } from '../fakes/index.js';

function setup() {
  const users = new InMemoryUserRepository();

  return { useCase: new CreateUserUseCase(users), users };
}

describe('CreateUserUseCase', () => {
  it('cria o usuário e normaliza o e-mail', async () => {
    const { useCase, users } = setup();

    const result = await useCase.execute({
      name: 'Igor',
      email: '  Igor@Example.COM ',
      password: 'senha-forte',
    });

    expect(result.created).toBe(true);
    expect(users.users[0]?.email).toBe('igor@example.com');
  });

  it('é idempotente: não duplica o mesmo e-mail', async () => {
    const { useCase, users } = setup();
    const command = { name: 'Igor', email: 'a@b.com', password: 'senha-forte' };

    await useCase.execute(command);
    const second = await useCase.execute(command);

    expect(second.created).toBe(false);
    expect(users.users).toHaveLength(1);
  });

  it('rejeita senha curta', async () => {
    const { useCase } = setup();

    let captured: unknown;
    try {
      await useCase.execute({ name: 'Igor', email: 'a@b.com', password: 'curta' });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(InvalidUserDataError);
  });

  it('rejeita nome vazio e e-mail inválido', async () => {
    const { useCase } = setup();

    const errors: unknown[] = [];

    for (const command of [
      { name: '  ', email: 'a@b.com', password: 'senha-forte' },
      { name: 'Igor', email: 'sem-arroba', password: 'senha-forte' },
    ]) {
      try {
        await useCase.execute(command);
      } catch (error) {
        errors.push(error);
      }
    }

    expect(errors).toHaveLength(2);
    expect(errors[0]).toBeInstanceOf(InvalidUserDataError);
    expect(errors[1]).toBeInstanceOf(InvalidUserDataError);
  });
});
