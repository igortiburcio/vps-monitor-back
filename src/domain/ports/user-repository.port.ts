export interface CreateUserInput {
  name: string;
  email: string;
  /** senha em texto puro: o adapter é responsável por gerar o hash */
  password: string;
}

/** Porta de saída: usuários do app (BetterAuth é dono das tabelas). */
export abstract class UserRepositoryPort {
  abstract existsByEmail(email: string): Promise<boolean>;
  abstract create(input: CreateUserInput): Promise<{ id: string }>;
}
