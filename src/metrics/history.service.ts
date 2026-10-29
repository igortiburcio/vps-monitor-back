import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DatabaseService } from '../db/database.service.js';
import { metricSamples } from '../db/schema.js';

export const HISTORY_METRICS = ['cpu', 'memory', 'load', 'net_rx', 'net_tx', 'disk'] as const;

export type HistoryMetric = (typeof HISTORY_METRICS)[number];

const COLUMN: Record<HistoryMetric, string> = {
  cpu: 'cpu_pct',
  memory: 'mem_used',
  load: 'load1',
  net_rx: 'net_rx_bps',
  net_tx: 'net_tx_bps',
  disk: 'disk_used',
};

export interface HistoryPoint {
  ts: string;
  value: number | null;
}

/**
 * Agregação em Postgres puro: bucket por `floor(epoch / step)`.
 * Funciona sem Timescale; se a série crescer, a troca é só na query.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly database: DatabaseService) {}

  async series(
    metric: HistoryMetric,
    rangeSeconds: number,
    stepSeconds: number,
  ): Promise<HistoryPoint[]> {
    const from = new Date(Date.now() - rangeSeconds * 1000).toISOString();

    const rows = (await this.database.db.execute(sql`
      select
        to_timestamp(floor(extract(epoch from ${metricSamples.ts}) / ${stepSeconds}) * ${stepSeconds}) as bucket,
        avg(${sql.raw(COLUMN[metric])})::float8 as value
      from ${metricSamples}
      where ${metricSamples.ts} >= ${from}
      group by 1
      order by 1 asc
    `)) as unknown as { bucket: Date | string; value: number | null }[];

    return rows.map((row) => ({
      ts: new Date(row.bucket).toISOString(),
      value: row.value === null ? null : Number(row.value),
    }));
  }
}
