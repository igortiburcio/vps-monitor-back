export * from './auth-schema.js';

import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Amostra do host a cada METRICS_INTERVAL_MS.
 * Valores de rede são deltas por segundo calculados no coletor.
 */
export const metricSamples = pgTable(
  'metric_samples',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),

    cpuPct: real('cpu_pct'),
    cpuPerCore: real('cpu_per_core').array(),
    memUsed: bigint('mem_used', { mode: 'number' }),
    memTotal: bigint('mem_total', { mode: 'number' }),
    swapUsed: bigint('swap_used', { mode: 'number' }),

    load1: real('load1'),
    load5: real('load5'),
    load15: real('load15'),

    diskUsed: bigint('disk_used', { mode: 'number' }),
    diskTotal: bigint('disk_total', { mode: 'number' }),

    netRxBps: bigint('net_rx_bps', { mode: 'number' }),
    netTxBps: bigint('net_tx_bps', { mode: 'number' }),

    uptimeSec: bigint('uptime_sec', { mode: 'number' }),
    tempC: real('temp_c'),
  },
  (table) => [index('metric_samples_ts_idx').on(table.ts.desc())],
);

export const containerSamples = pgTable(
  'container_samples',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),

    containerId: text('container_id').notNull(),
    name: text('name'),
    /** UUID do app/banco correspondente no Coolify, quando houver */
    coolifyUuid: text('coolify_uuid'),

    cpuPct: real('cpu_pct'),
    memUsed: bigint('mem_used', { mode: 'number' }),
    memLimit: bigint('mem_limit', { mode: 'number' }),

    netRx: bigint('net_rx', { mode: 'number' }),
    netTx: bigint('net_tx', { mode: 'number' }),
    blockRead: bigint('block_read', { mode: 'number' }),
    blockWrite: bigint('block_write', { mode: 'number' }),

    status: text('status'),
    health: text('health'),
  },
  (table) => [index('container_samples_container_ts_idx').on(table.containerId, table.ts.desc())],
);

export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content'),
    toolCalls: jsonb('tool_calls'),
    toolCallId: text('tool_call_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_messages_conversation_idx').on(table.conversationId, table.createdAt)],
);
