import type { ContainerSnapshot } from './container.js';
import type { CoolifyInventory } from './coolify.js';
import type { HostMetrics } from './host-metrics.js';

/** Retrato do servidor num instante: host + containers + inventário. */
export interface MetricsSnapshot {
  collectedAt: Date;
  host: HostMetrics;
  containers: ContainerSnapshot[];
  coolify: CoolifyInventory;
}
