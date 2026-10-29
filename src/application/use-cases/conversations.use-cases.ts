import { Injectable } from '@nestjs/common';

import type { ConversationSummary, StoredMessage } from '../../domain/entities/conversation.js';
import { ConversationNotFoundError } from '../../domain/errors/domain.errors.js';
import { ConversationRepositoryPort } from '../../domain/ports/conversation-repository.port.js';

@Injectable()
export class ListConversationsUseCase {
  constructor(private readonly conversations: ConversationRepositoryPort) {}

  async execute(limit = 30): Promise<ConversationSummary[]> {
    return this.conversations.list(limit);
  }
}

@Injectable()
export class GetConversationUseCase {
  constructor(private readonly conversations: ConversationRepositoryPort) {}

  async execute(conversationId: string): Promise<StoredMessage[]> {
    if (!(await this.conversations.exists(conversationId))) {
      throw new ConversationNotFoundError(conversationId);
    }

    return this.conversations.detail(conversationId);
  }
}
