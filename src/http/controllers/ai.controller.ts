import { Body, Controller, Get, Logger, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { ChatWithAgentUseCase } from '../../application/use-cases/chat-with-agent.use-case.js';
import {
  GetConversationUseCase,
  ListConversationsUseCase,
} from '../../application/use-cases/conversations.use-cases.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';

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
    private readonly chat: ChatWithAgentUseCase,
    private readonly listConversations: ListConversationsUseCase,
    private readonly getConversation: GetConversationUseCase,
  ) {}

  /**
   * Chat com streaming via SSE (POST).
   * Eventos: start, token, tool_start, tool_result, done, error.
   */
  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async stream(
    @Body(new ZodValidationPipe(chatSchema)) body: ChatBody,
    @Res() reply: FastifyReply,
  ): Promise<void> {
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

    try {
      for await (const event of this.chat.execute(body)) {
        send(event.type, event);
      }
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
    return { conversations: await this.listConversations.execute() };
  }

  @Get('conversations/:id')
  async detail(@Param('id') id: string) {
    return { id, messages: await this.getConversation.execute(id) };
  }
}
