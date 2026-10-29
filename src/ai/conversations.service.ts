import { AIMessage, type BaseMessage, HumanMessage } from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';

import { DatabaseService } from '../db/database.service.js';
import { aiConversations, aiMessages } from '../db/schema.js';

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: string;
  content: string | null;
  createdAt: string;
}

const HISTORY_LIMIT = 20;

@Injectable()
export class ConversationsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  /** Cria a conversa se o id não existir (ou não vier). */
  async ensure(conversationId: string | undefined, firstMessage: string): Promise<string> {
    if (conversationId) {
      const [existing] = await this.db
        .select({ id: aiConversations.id })
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationId))
        .limit(1);

      if (existing) return existing.id;
    }

    const [created] = await this.db
      .insert(aiConversations)
      .values({ title: firstMessage.slice(0, 80) })
      .returning({ id: aiConversations.id });

    if (!created) throw new Error('Falha ao criar a conversa');

    return created.id;
  }

  /** Histórico no formato do LangChain, limitado às últimas mensagens. */
  async history(conversationId: string): Promise<BaseMessage[]> {
    const rows = await this.db
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(HISTORY_LIMIT);

    return rows
      .reverse()
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .filter((row) => Boolean(row.content))
      .map((row) =>
        row.role === 'user'
          ? new HumanMessage(row.content ?? '')
          : new AIMessage(row.content ?? ''),
      );
  }

  async append(conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    await this.db.insert(aiMessages).values({ conversationId, role, content });

    await this.db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, conversationId));
  }

  async list(limit = 30): Promise<ConversationSummary[]> {
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
}
