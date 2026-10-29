import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import type { GetContainerLogsUseCase } from '../../application/use-cases/get-container-logs.use-case.js';
import type { GetCoolifyInventoryUseCase } from '../../application/use-cases/get-coolify-inventory.use-case.js';
import type { GetHostHistoryUseCase } from '../../application/use-cases/get-host-history.use-case.js';
import type { GetOverviewUseCase } from '../../application/use-cases/get-overview.use-case.js';
import { HISTORY_METRICS } from '../../domain/entities/history-metric.js';

export interface ToolDependencies {
  overview: GetOverviewUseCase;
  history: GetHostHistoryUseCase;
  logs: GetContainerLogsUseCase;
  coolify: GetCoolifyInventoryUseCase;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Ferramentas do agente. Todas somente leitura — nenhuma executa
 * comando na VPS. O retorno é compacto para caber no contexto.
 */
export function buildTools(deps: ToolDependencies) {
  const hostSnapshot = tool(
    async () => {
      const overview = await deps.overview.execute();
      if (!overview) return 'Ainda não há amostras coletadas.';

      // Só os maiores consumidores: o snapshot completo estoura o TPM do provedor
      const topContainers = [...overview.containers]
        .sort((a, b) => (b.memUsed ?? 0) - (a.memUsed ?? 0))
        .slice(0, 10);

      return json({
        collectedAt: overview.collectedAt,
        host: overview.host,
        totalContainers: overview.containers.length,
        topContainersByMemory: topContainers.map((container) => ({
          name: container.displayName,
          state: container.state,
          cpuPct: container.cpuPct,
          memPct: container.memPct,
          memUsed: container.memUsed,
        })),
      });
    },
    {
      name: 'host_snapshot',
      description:
        'Métricas ATUAIS do servidor (CPU, memória, swap, load, disco, rede, uptime) e resumo dos containers. Use antes de responder qualquer pergunta sobre o estado atual.',
      schema: z.object({}),
    },
  );

  const hostHistory = tool(
    async ({ metric, minutes }) => {
      const rangeSeconds = minutes * 60;
      const stepSeconds = Math.max(60, Math.round(rangeSeconds / 30));
      const series = await deps.history.execute(metric, rangeSeconds, stepSeconds);

      if (series.points.length === 0) {
        return `Não há histórico de ${metric} nos últimos ${minutes} minutos.`;
      }

      const values = series.points
        .map((point) => point.value)
        .filter((value): value is number => value !== null);

      return json({
        metric,
        windowMinutes: minutes,
        from: series.points[0]?.ts,
        to: series.points.at(-1)?.ts,
        samples: values.length,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        avg: values.length
          ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
          : null,
        series: series.points.slice(-30),
      });
    },
    {
      name: 'host_history',
      description:
        'Série histórica agregada de uma métrica do host. Use para tendências ("como estava a CPU na última hora?", "teve pico de memória?").',
      schema: z.object({
        metric: z.enum(HISTORY_METRICS).describe('métrica a consultar'),
        minutes: z
          .number()
          .int()
          .min(5)
          .max(1440)
          .default(60)
          .describe('janela em minutos (padrão 60)'),
      }),
    },
  );

  const listContainers = tool(
    async () => {
      const overview = await deps.overview.execute();
      if (!overview) return 'Ainda não há amostras coletadas.';
      if (overview.containers.length === 0) {
        return 'Nenhum container visível (o socket do Docker pode estar indisponível).';
      }

      return json(
        overview.containers.map((container) => ({
          name: container.displayName,
          state: container.state,
          health: container.health,
          cpuPct: container.cpuPct,
          memPct: container.memPct,
          memUsed: container.memUsed,
          memLimit: container.memLimit,
        })),
      );
    },
    {
      name: 'list_containers',
      description:
        'Lista todos os containers com CPU, memória e estado de saúde. Use para "quais containers estão rodando" ou "qual consome mais RAM".',
      schema: z.object({}),
    },
  );

  const containerLogs = tool(
    async ({ name, lines }) => {
      try {
        const result = await deps.logs.execute(name, lines);

        return result.available ? result.logs : `Não foi possível ler os logs de "${name}".`;
      } catch {
        return `Container "${name}" não encontrado.`;
      }
    },
    {
      name: 'container_logs',
      description:
        'Últimas linhas de log de um container (segredos são mascarados). Use para investigar erros e crashes.',
      schema: z.object({
        name: z.string().describe('nome do container'),
        lines: z.number().int().min(1).max(200).default(50).describe('quantidade de linhas'),
      }),
    },
  );

  const coolifyInventory = tool(
    async () => {
      const inventory = await deps.coolify.inventory();

      if (!inventory.configured) return 'Integração com o Coolify não está configurada.';

      return json({
        applications: inventory.applications.map((app) => ({
          name: app.name,
          status: app.status,
          fqdn: app.fqdn,
          uuid: app.uuid,
        })),
        databases: inventory.databases.map((database) => ({
          name: database.name,
          type: database.type,
          status: database.status,
          isPublic: database.isPublic,
        })),
        services: inventory.services.map((service) => ({
          name: service.name,
          type: service.type,
          status: service.status,
        })),
        servers: inventory.servers,
      });
    },
    {
      name: 'coolify_apps',
      description:
        'Inventário do Coolify: aplicações, bancos, services e servidores, com status e domínio.',
      schema: z.object({}),
    },
  );

  return [hostSnapshot, hostHistory, listContainers, containerLogs, coolifyInventory];
}
