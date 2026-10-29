import { percentage } from '../../domain/entities/host-metrics.js';
import type { MetricsSnapshot } from '../../domain/entities/metrics-snapshot.js';
import type { Overview, OverviewContainer } from '../dto/overview.dto.js';

/**
 * Formato único consumido pela home do app, pelo SSE e pelo agente.
 * Deliberadamente compacto: é o mesmo payload que vai para o LLM.
 */
export function toOverview(snapshot: MetricsSnapshot): Overview {
  const { host, containers, coolify } = snapshot;

  // UUID → nome amigável (apps, bancos e services do Coolify)
  const coolifyNames = new Map<string, string>();
  for (const app of coolify.applications) coolifyNames.set(app.uuid, app.name);
  for (const database of coolify.databases) coolifyNames.set(database.uuid, database.name);
  for (const service of coolify.services) coolifyNames.set(service.uuid, service.name);

  const mapContainer = (container: MetricsSnapshot['containers'][number]): OverviewContainer => ({
    id: container.id,
    name: container.name,
    displayName:
      (container.coolifyUuid ? coolifyNames.get(container.coolifyUuid) : undefined) ??
      container.name,
    image: container.image,
    state: container.state,
    status: container.status,
    health: container.health,
    coolifyUuid: container.coolifyUuid,
    cpuPct: container.stats?.cpuPct ?? null,
    memUsed: container.stats?.memUsed ?? null,
    memLimit: container.stats?.memLimit ?? null,
    memPct: percentage(container.stats?.memUsed ?? null, container.stats?.memLimit ?? null),
    netRx: container.stats?.netRx ?? null,
    netTx: container.stats?.netTx ?? null,
  });

  return {
    collectedAt: snapshot.collectedAt.toISOString(),
    host: {
      available: host.available,
      cpuPct: host.cpuPct,
      cpuPerCore: host.cpuPerCore,
      memUsed: host.memUsed,
      memTotal: host.memTotal,
      memPct: percentage(host.memUsed, host.memTotal),
      swapUsed: host.swapUsed,
      load1: host.load1,
      load5: host.load5,
      load15: host.load15,
      diskUsed: host.diskUsed,
      diskTotal: host.diskTotal,
      diskPct: percentage(host.diskUsed, host.diskTotal),
      netRxBps: host.netRxBps,
      netTxBps: host.netTxBps,
      uptimeSec: host.uptimeSec,
      tempC: host.tempC,
    },
    containers: containers.map(mapContainer),
    coolify: {
      configured: coolify.configured,
      applications: coolify.applications,
      databases: coolify.databases,
      servers: coolify.servers,
      services: coolify.services,
    },
  };
}
