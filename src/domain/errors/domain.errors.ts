/** Erro de domínio: recurso pedido não existe. */
export class ContainerNotFoundError extends Error {
  constructor(readonly identifier: string) {
    super(`Container "${identifier}" não encontrado`);
    this.name = 'ContainerNotFoundError';
  }
}

export class ConversationNotFoundError extends Error {
  constructor(readonly identifier: string) {
    super(`Conversa "${identifier}" não encontrada`);
    this.name = 'ConversationNotFoundError';
  }
}

export class InvalidUserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserDataError';
  }
}
