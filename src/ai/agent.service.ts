import type { BaseMessage } from '@langchain/core/messages';
import { ChatGroq } from '@langchain/groq';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable, Logger } from '@nestjs/common';

import { CoolifyService } from '../collectors/coolify/coolify.service.js';
import { DockerService } from '../collectors/docker/docker.service.js';
import { sanitizeSecrets, truncate } from '../common/sanitize.js';
import { env } from '../config/env.js';
import { HistoryService } from '../metrics/history.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { buildTools } from './tools.js';

export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_start'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; output: string }
  | { type: 'error'; message: string };

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

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly agent: StreamableAgent;

  constructor(
    metrics: MetricsService,
    docker: DockerService,
    coolify: CoolifyService,
    history: HistoryService,
  ) {
    const tools = buildTools({ metrics, docker, coolify, history });
    this.agent = createReactAgent({
      llm: createChatModel(),
      tools,
      prompt: SYSTEM_PROMPT,
    }) as StreamableAgent;
  }

  /**
   * Executa o agente e emite eventos conforme o modelo responde e
   * conforme cada ferramenta é chamada.
   */
  async *stream(message: string, history: BaseMessage[]): AsyncGenerator<AgentEvent> {
    const events = this.agent.streamEvents(
      { messages: [...history, { role: 'user', content: message }] },
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
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.error(`falha no agente: ${message}`);

      const isRateLimit = message.includes('429') || message.includes('rate_limit');

      yield {
        type: 'error',
        message: isRateLimit
          ? 'Limite de tokens do provedor atingido. Tente novamente em alguns segundos.'
          : 'Não consegui concluir a consulta ao modelo. Tente novamente.',
      };
    }
  }
}
