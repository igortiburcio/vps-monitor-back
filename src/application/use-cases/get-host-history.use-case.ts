import { Injectable } from '@nestjs/common';

import type { HistorySeries } from '../../domain/entities/history.js';
import type { HistoryMetric } from '../../domain/entities/history-metric.js';
import { MetricsRepositoryPort } from '../../domain/ports/metrics-repository.port.js';

@Injectable()
export class GetHostHistoryUseCase {
  constructor(private readonly repository: MetricsRepositoryPort) {}

  async execute(
    metric: HistoryMetric,
    rangeSeconds: number,
    stepSeconds: number,
  ): Promise<HistorySeries> {
    const points = await this.repository.series(metric, rangeSeconds, stepSeconds);

    return { metric, rangeSeconds, stepSeconds, points };
  }
}
