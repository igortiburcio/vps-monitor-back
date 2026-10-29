import { z } from 'zod';

import { HISTORY_METRICS } from '../../../metrics/history.service.js';

export const historyQuerySchema = z.object({
  metric: z.enum(HISTORY_METRICS).default('cpu'),
  /** janela em segundos */
  range: z.coerce
    .number()
    .int()
    .min(60)
    .max(30 * 24 * 60 * 60)
    .default(3600),
  /** tamanho do bucket em segundos */
  step: z.coerce
    .number()
    .int()
    .min(5)
    .max(24 * 60 * 60)
    .default(60),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const logsQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(500).default(100),
});

export type LogsQuery = z.infer<typeof logsQuerySchema>;
