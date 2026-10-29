import type { ContainerSnapshot } from '../entities/container.js';
import type { HistoryPoint } from '../entities/history.js';
import type { HistoryMetric } from '../entities/history-metric.js';
import type { HostMetrics } from '../entities/host-metrics.js';

/** Porta de saída: persistência de séries temporais. */
export abstract class MetricsRepositoryPort {
  abstract saveHost(sample: HostMetrics): Promise<void>;
  abstract saveContainers(collectedAt: Date, containers: ContainerSnapshot[]): Promise<void>;
  abstract series(
    metric: HistoryMetric,
    rangeSeconds: number,
    stepSeconds: number,
  ): Promise<HistoryPoint[]>;
  abstract prune(hostBefore: Date, containersBefore: Date): Promise<void>;
}
