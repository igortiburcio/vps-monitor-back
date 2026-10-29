import { describe, expect, it } from 'bun:test';

import { ChatWithAgentUseCase } from '../../src/application/use-cases/chat-with-agent.use-case.js';
import type { ChatEvent } from '../../src/domain/entities/conversation.js';
import { FakeChatAgent, InMemoryConversationsRepository } from '../fakes/index.js';

function setup() {
  const conversations = new InMemoryConversationsRepository();
  const agent = new FakeChatAgent();

  return { useCase: new ChatWithAgentUseCase(conversations, agent), conversations, agent };
}

async function collect(stream: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];

  for await (const event of stream) events.push(event);

  return events;
}

describe('ChatWithAgentUseCase', () => {
  it('emite start, tokens do agente e done', async () => {
    const { useCase } = setup();

    const events = await collect(useCase.execute({ message: 'olá' }));

    expect(events[0]?.type).toBe('start');
    expect(events.some((event) => event.type === 'token')).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('persiste a pergunta e a resposta', async () => {
    const { useCase, conversations } = setup();

    const events = await collect(useCase.execute({ message: 'como está a cpu?' }));
    const conversationId = events[0]?.type === 'start' ? events[0].conversationId : '';
    const messages = await conversations.detail(conversationId);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.content).toBe('olá');
  });

  it('não persiste resposta vazia', async () => {
    const { useCase, agent, conversations } = setup();
    agent.events = [{ type: 'error', message: 'falhou' }];

    const events = await collect(useCase.execute({ message: 'oi' }));
    const conversationId = events[0]?.type === 'start' ? events[0].conversationId : '';

    expect(await conversations.detail(conversationId)).toHaveLength(1);
  });

  it('reaproveita a conversa existente e envia o histórico ao agente', async () => {
    const { useCase, agent, conversations } = setup();
    const existingId = await conversations.ensure(undefined, 'primeira');
    await conversations.append(existingId, 'user', 'primeira');

    await collect(useCase.execute({ message: 'segunda', conversationId: existingId }));

    expect(agent.receivedHistory).toHaveLength(1);
    expect(agent.receivedHistory[0]?.content).toBe('primeira');
  });

  it('cria conversa nova quando o id não existe', async () => {
    const { useCase, conversations } = setup();

    const events = await collect(useCase.execute({ message: 'nova', conversationId: 'sumiu' }));
    const conversationId = events[0]?.type === 'start' ? events[0].conversationId : '';

    expect(conversationId).not.toBe('sumiu');
    expect(await conversations.exists(conversationId)).toBe(true);
  });
});
