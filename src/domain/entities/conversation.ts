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

/** Turno de conversa no formato neutro (sem tipos de biblioteca de LLM). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Eventos emitidos durante o streaming do agente. */
export type ChatEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'token'; text: string }
  | { type: 'tool_start'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; output: string }
  | { type: 'error'; message: string }
  | { type: 'done'; conversationId: string };
