import type { ChatEvent, ChatTurn } from '../entities/conversation.js';

/** Porta de saída: provedor de LLM com tool calling. */
export abstract class ChatAgentPort {
  abstract readonly configured: boolean;
  abstract stream(message: string, history: ChatTurn[]): AsyncIterable<ChatEvent>;
}
