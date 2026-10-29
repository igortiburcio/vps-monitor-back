import { Body, Controller, Get, Logger, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AgentService } from './agent.service.js';
import { ConversationsService } from './conversations.service.js';

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.uuid().optional(),
});

type ChatBody = z.infer<typeof chatSchema>;

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/v1/ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly agent: AgentService,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * Chat com streaming via SSE (POST).
   * Eventos: start, token, tool_start, tool_result, done, error.
   */
  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async chat(
    @Body(new ZodValidationPipe(chatSchema)) body: ChatBody,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const conversationId = await this.conversations.ensure(body.conversationId, body.message);
    const history = await this.conversations.history(conversationId);

    await this.conversations.append(conversationId, 'user', body.message);

    // Assumimos a resposta: sem isso o Fastify tentaria enviar o próprio body.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let closed = false;
    reply.raw.on('close', () => {
      closed = true;
    });

    const send = (event: string, data: unknown): void => {
      if (closed) return;
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let answer = '';

    try {
      send('start', { conversationId });

      for await (const event of this.agent.stream(body.message, history)) {
        if (event.type === 'token') answer += event.text;
        send(event.type, event);
      }

      if (answer) {
        await this.conversations.append(conversationId, 'assistant', answer);
      }

      send('done', { conversationId });
    } catch (error) {
      this.logger.error(
        `falha no chat: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      send('error', { message: 'Erro ao processar a pergunta.' });
    } finally {
      if (!closed) reply.raw.end();
    }
  }

  @Get('conversations')
  async list() {
    return { conversations: await this.conversations.list() };
  }

  @Get('conversations/:id')
  async detail(@Param('id') id: string) {
    const conversations = await this.conversations.list(200);
    const exists = conversations.some((conversation) => conversation.id === id);

    if (!exists) throw new NotFoundException(`Conversa "${id}" não encontrada`);

    return { id, messages: await this.conversations.detail(id) };
  }
}
