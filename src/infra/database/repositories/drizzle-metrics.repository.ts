import { Injectable } from '@nestjs/common';
import { lt, sql } from 'drizzle-orm';

import type { ContainerSnapshot } from '../../../domain/entities/container.js';
import type { HistoryPoint } from '../../../domain/entities/history.js';
import type { HistoryMetric } from '../../../domain/entities/history-metric.js';
import type { HostMetrics } from '../../../domain/entities/host-metrics.js';
import { MetricsRepositoryPort } from '../../../domain/ports/metrics-repository.port.js';
import { DatabaseService } from '../database.service.js';
import { containerSamples, metricSamples } from '../schema.js';

const COLUMN: Record<HistoryMetric, string> = {
  cpu: 'cpu_pct',
  memory: 'mem_used',
  load: 'load1',
  net_rx: 'net_rx_bps',
  net_tx: 'net_tx_bps',
  disk: 'disk_used',
};

@Injectable()
export class DrizzleMetricsRepository extends MetricsRepositoryPort {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async saveHost(sample: HostMetrics): Promise<void> {
    if (!sample.available) return;

    await this.database.db.insert(metricSamples).values({
      ts: sample.ts,
      cpuPct: sample.cpuPct,
      cpuPerCore: sample.cpuPerCore,
      memUsed: sample.memUsed,
      memTotal: sample.memTotal,
      swapUsed: sample.swapUsed,
      load1: sample.load1,
      load5: sample.load5,
      load15: sample.load15,
      diskUsed: sample.diskUsed,
      diskTotal: sample.diskTotal,
      netRxBps: sample.netRxBps,
      netTxBps: sample.netTxBps,
      uptimeSec: sample.uptimeSec,
      tempC: sample.tempC,
    });
  }

  async saveContainers(collectedAt: Date, containers: ContainerSnapshot[]): Promise<void> {
    if (containers.length === 0) return;

    await this.database.db.insert(containerSamples).values(
      containers.map((container) => ({
        ts: collectedAt,
        containerId: container.id,
        name: container.name,
        coolifyUuid: container.coolifyUuid,
        cpuPct: container.stats?.cpuPct ?? null,
        memUsed: container.stats?.memUsed ?? null,
        memLimit: container.stats?.memLimit ?? null,
        netRx: container.stats?.netRx ?? null,
        netTx: container.stats?.netTx ?? null,
        blockRead: container.stats?.blockRead ?? null,
        blockWrite: container.stats?.blockWrite ?? null,
        status: container.state,
        health: container.health,
      })),
    );
  }

  /**
   * Agregação em Postgres puro: bucket por `floor(epoch / step)`.
   * Funciona sem Timescale; se a série crescer, a troca é só na query.
   */
  async series(
    metric: HistoryMetric,
    rangeSeconds: number,
    stepSeconds: number,
  ): Promise<HistoryPoint[]> {
    // postgres.js não serializa Date em parâmetros de `db.execute`: usamos ISO.
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

  async prune(hostBefore: Date, containersBefore: Date): Promise<void> {
    await this.database.db.delete(metricSamples).where(lt(metricSamples.ts, hostBefore));
    await this.database.db
      .delete(containerSamples)
      .where(lt(containerSamples.ts, containersBefore));
  }
}
