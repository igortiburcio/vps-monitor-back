import { Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';

import type {
  ChatTurn,
  ConversationSummary,
  StoredMessage,
} from '../../../domain/entities/conversation.js';
import { ConversationRepositoryPort } from '../../../domain/ports/conversation-repository.port.js';
import { DatabaseService } from '../database.service.js';
import { aiConversations, aiMessages } from '../schema.js';

const HISTORY_LIMIT = 10;

@Injectable()
export class DrizzleConversationsRepository extends ConversationRepositoryPort {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  private get db() {
    return this.database.db;
  }

  async ensure(conversationId: string | undefined, firstMessage: string): Promise<string> {
    if (conversationId && (await this.exists(conversationId))) {
      return conversationId;
    }

    const [created] = await this.db
      .insert(aiConversations)
      .values({ title: firstMessage.slice(0, 80) })
      .returning({ id: aiConversations.id });

    if (!created) throw new Error('Falha ao criar a conversa');

    return created.id;
  }

  async history(conversationId: string): Promise<ChatTurn[]> {
    const rows = await this.db
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(HISTORY_LIMIT);

    return rows
      .reverse()
      .filter((row) => (row.role === 'user' || row.role === 'assistant') && Boolean(row.content))
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content ?? '',
      }));
  }

  async append(conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    await this.db.insert(aiMessages).values({ conversationId, role, content });

    await this.db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, conversationId));
  }

  async list(limit: number): Promise<ConversationSummary[]> {
    const rows = await this.db
      .select()
      .from(aiConversations)
      .orderBy(desc(aiConversations.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async detail(conversationId: string): Promise<StoredMessage[]> {
    const rows = await this.db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async exists(conversationId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    return Boolean(row);
  }
}
