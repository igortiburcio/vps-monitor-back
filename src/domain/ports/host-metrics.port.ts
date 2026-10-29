import type { HostMetrics } from '../entities/host-metrics.js';

/** Porta de saída: de onde vêm as métricas do host. */
export abstract class HostMetricsPort {
  abstract sample(): Promise<HostMetrics>;
}
