import { AIMessage, type BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatGroq } from '@langchain/groq';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable, Logger } from '@nestjs/common';

import { GetContainerLogsUseCase } from '../../application/use-cases/get-container-logs.use-case.js';
import { GetCoolifyInventoryUseCase } from '../../application/use-cases/get-coolify-inventory.use-case.js';
import { GetHostHistoryUseCase } from '../../application/use-cases/get-host-history.use-case.js';
import { GetOverviewUseCase } from '../../application/use-cases/get-overview.use-case.js';
import type { ChatEvent, ChatTurn } from '../../domain/entities/conversation.js';
import { ChatAgentPort } from '../../domain/ports/chat-agent.port.js';
import { sanitizeSecrets, truncate } from '../../domain/sanitization.js';
import { env } from '../config/env.js';
import { buildTools } from './tools.js';

/** Formato dos eventos do `streamEvents(..., { version: 'v2' })`. */
interface StreamEventLike {
  event: string;
  name?: string;
  data?: {
    chunk?: { content?: unknown };
    input?: unknown;
    output?: unknown;
  };
}

/** O retorno de createReactAgent é genérico; tipamos só o que usamos. */
interface StreamableAgent {
  streamEvents(input: unknown, options: { version: 'v2' }): AsyncIterable<unknown>;
}

const SYSTEM_PROMPT = `Você é o VPS Monitor, assistente de infraestrutura de um servidor Linux que roda Coolify.

Regras:
- Responda em português do Brasil, de forma curta e direta.
- NUNCA invente números. Sempre consulte uma ferramenta antes de afirmar qualquer valor.
- Se a ferramenta não retornar o dado, diga claramente que não tem essa informação.
- Você só tem acesso de LEITURA. Nunca sugira que executou comandos ou alterou algo.
- Cite nomes reais de containers e aplicações.
- Formate números com unidade (%, MB, GB) e arredonde para uma casa decimal.
- Ao comparar containers, ordene do maior para o menor consumo.`;

function chunkText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          const text = (block as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }

  return '';
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object' && 'content' in value) {
    const content = (value as { content?: unknown }).content;
    if (typeof content === 'string') return content;
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function createChatModel() {
  if (env.LLM_PROVIDER === 'deepseek') {
    return new ChatOpenAI({
      apiKey: env.DEEPSEEK_API_KEY ?? '',
      model: env.LLM_MODEL.includes('deepseek') ? env.LLM_MODEL : 'deepseek-chat',
      temperature: 0,
      configuration: { baseURL: 'https://api.deepseek.com' },
    });
  }

  return new ChatGroq({
    apiKey: env.GROQ_API_KEY ?? '',
    model: env.LLM_MODEL,
    temperature: 0,
    // O free tier tem TPM baixo; retentativas evitam falha em picos
    maxRetries: 3,
  });
}

function toMessages(history: ChatTurn[]): BaseMessage[] {
  return history.map((turn) =>
    turn.role === 'user' ? new HumanMessage(turn.content) : new AIMessage(turn.content),
  );
}

@Injectable()
export class LangGraphAgentAdapter extends ChatAgentPort {
  private readonly logger = new Logger(LangGraphAgentAdapter.name);
  private readonly agent: StreamableAgent;

  constructor(
    overview: GetOverviewUseCase,
    history: GetHostHistoryUseCase,
    logs: GetContainerLogsUseCase,
    coolify: GetCoolifyInventoryUseCase,
  ) {
    super();

    const tools = buildTools({ overview, history, logs, coolify });

    this.agent = createReactAgent({
      llm: createChatModel(),
      tools,
      prompt: SYSTEM_PROMPT,
    }) as StreamableAgent;
  }

  get configured(): boolean {
    return Boolean(env.GROQ_API_KEY ?? env.DEEPSEEK_API_KEY);
  }

  async *stream(message: string, history: ChatTurn[]): AsyncGenerator<ChatEvent> {
    const events = this.agent.streamEvents(
      { messages: [...toMessages(history), new HumanMessage(message)] },
      { version: 'v2' },
    );

    try {
      for await (const raw of events) {
        const event = raw as StreamEventLike;

        if (event.event === 'on_chat_model_stream') {
          const text = chunkText(event.data?.chunk?.content);
          if (text) yield { type: 'token', text };
        }

        if (event.event === 'on_tool_start') {
          yield { type: 'tool_start', name: event.name ?? 'tool', input: event.data?.input };
        }

        if (event.event === 'on_tool_end') {
          yield {
            type: 'tool_result',
            name: event.name ?? 'tool',
            output: truncate(sanitizeSecrets(stringifyOutput(event.data?.output)), 2000),
          };
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.error(`falha no agente: ${detail}`);

      const isRateLimit = detail.includes('429') || detail.includes('rate_limit');

      yield {
        type: 'error',
        message: isRateLimit
          ? 'Limite de tokens do provedor atingido. Tente novamente em alguns segundos.'
          : 'Não consegui concluir a consulta ao modelo. Tente novamente.',
      };
    }
  }
}
