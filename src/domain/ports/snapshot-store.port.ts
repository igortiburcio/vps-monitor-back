import type { MetricsSnapshot } from '../entities/metrics-snapshot.js';

/** Porta de saída: cache do último retrato (leitura rápida). */
export abstract class SnapshotStorePort {
  abstract push(snapshot: MetricsSnapshot): void;
  abstract latest(): MetricsSnapshot | null;
  abstract recent(limit: number): MetricsSnapshot[];
}
