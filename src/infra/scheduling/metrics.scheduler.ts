import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { CollectMetricsUseCase } from '../../application/use-cases/collect-metrics.use-case.js';
import { PruneMetricsUseCase } from '../../application/use-cases/prune-metrics.use-case.js';
import { env } from '../config/env.js';

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CONTAINERS_RETENTION_DAYS = 7;

/** Dispara a coleta periódica e a limpeza diária. */
@Injectable()
export class MetricsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsScheduler.name);
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private readonly collectMetrics: CollectMetricsUseCase,
    private readonly pruneMetrics: PruneMetricsUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collectMetrics.execute();

    this.timers.push(
      setInterval(() => {
        void this.collectMetrics.execute();
      }, env.METRICS_INTERVAL_MS),
    );

    this.timers.push(
      setInterval(() => {
        void this.pruneMetrics.execute({
          hostDays: env.METRICS_RETENTION_DAYS,
          containersDays: CONTAINERS_RETENTION_DAYS,
        });
      }, RETENTION_INTERVAL_MS),
    );

    this.logger.log(`coleta a cada ${env.METRICS_INTERVAL_MS}ms`);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
  }
}
