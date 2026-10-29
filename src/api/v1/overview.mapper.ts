import type { MetricsSnapshot } from '../../metrics/metrics.service.js';

function percent(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null;
  return Number(((used / total) * 100).toFixed(1));
}

/**
 * Formato único consumido pela home do app e pelo SSE.
 * Deliberadamente compacto: é o mesmo payload que vai para o LLM.
 */
export function buildOverview(snapshot: MetricsSnapshot) {
  const { host, containers, coolify } = snapshot;

  // UUID → nome amigável (apps e bancos do Coolify)
  const coolifyNames = new Map<string, string>();
  for (const app of coolify.applications) coolifyNames.set(app.uuid, app.name);
  for (const database of coolify.databases) coolifyNames.set(database.uuid, database.name);

  return {
    collectedAt: snapshot.collectedAt.toISOString(),
    host: {
      available: host.available,
      cpuPct: host.cpuPct,
      cpuPerCore: host.cpuPerCore,
      memUsed: host.memUsed,
      memTotal: host.memTotal,
      memPct: percent(host.memUsed, host.memTotal),
      swapUsed: host.swapUsed,
      load1: host.load1,
      load5: host.load5,
      load15: host.load15,
      diskUsed: host.diskUsed,
      diskTotal: host.diskTotal,
      diskPct: percent(host.diskUsed, host.diskTotal),
      netRxBps: host.netRxBps,
      netTxBps: host.netTxBps,
      uptimeSec: host.uptimeSec,
      tempC: host.tempC,
    },
    containers: containers.map((container) => ({
      id: container.id,
      name: container.name,
      /** nome legível: o container do Coolify é nomeado pelo UUID do recurso */
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
      memPct: percent(container.stats?.memUsed ?? null, container.stats?.memLimit ?? null),
      netRx: container.stats?.netRx ?? null,
      netTx: container.stats?.netTx ?? null,
    })),
    coolify: {
      configured: coolify.configured,
      applications: coolify.applications,
      databases: coolify.databases,
      servers: coolify.servers,
    },
  };
}

export type Overview = ReturnType<typeof buildOverview>;
