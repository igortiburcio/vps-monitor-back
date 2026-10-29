import type { ChatTurn, ConversationSummary, StoredMessage } from '../entities/conversation.js';

/** Porta de saída: histórico de conversas com o agente. */
export abstract class ConversationRepositoryPort {
  /** Cria a conversa se o id não existir (ou não vier) e devolve o id. */
  abstract ensure(conversationId: string | undefined, firstMessage: string): Promise<string>;
  abstract history(conversationId: string): Promise<ChatTurn[]>;
  abstract append(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void>;
  abstract list(limit: number): Promise<ConversationSummary[]>;
  abstract detail(conversationId: string): Promise<StoredMessage[]>;
  abstract exists(conversationId: string): Promise<boolean>;
}
