import { Injectable } from '@nestjs/common';

import type { ChatEvent } from '../../domain/entities/conversation.js';
import { ChatAgentPort } from '../../domain/ports/chat-agent.port.js';
import { ConversationRepositoryPort } from '../../domain/ports/conversation-repository.port.js';

export interface ChatInput {
  message: string;
  conversationId?: string;
}

@Injectable()
export class ChatWithAgentUseCase {
  constructor(
    private readonly conversations: ConversationRepositoryPort,
    private readonly agent: ChatAgentPort,
  ) {}

  /**
   * Emite `start`, os eventos do agente e `done`.
   * A resposta só é persistida se houver conteúdo.
   */
  async *execute(input: ChatInput): AsyncGenerator<ChatEvent> {
    const conversationId = await this.conversations.ensure(input.conversationId, input.message);

    const history = await this.conversations.history(conversationId);
    await this.conversations.append(conversationId, 'user', input.message);

    yield { type: 'start', conversationId };

    let answer = '';

    for await (const event of this.agent.stream(input.message, history)) {
      if (event.type === 'token') answer += event.text;
      yield event;
    }

    if (answer) {
      await this.conversations.append(conversationId, 'assistant', answer);
    }

    yield { type: 'done', conversationId };
  }
}
