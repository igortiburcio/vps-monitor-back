import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { buildOverview } from '../api/v1/overview.mapper.js';
import type { CoolifyService } from '../collectors/coolify/coolify.service.js';
import type { DockerService } from '../collectors/docker/docker.service.js';
import { sanitizeSecrets, truncate } from '../common/sanitize.js';
import type { HistoryService } from '../metrics/history.service.js';
import { HISTORY_METRICS } from '../metrics/history.service.js';
import type { MetricsService } from '../metrics/metrics.service.js';

export interface ToolDependencies {
  metrics: MetricsService;
  docker: DockerService;
  coolify: CoolifyService;
  history: HistoryService;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Ferramentas do agente. Todas são somente leitura — nenhuma executa
 * comando na VPS. O retorno é sempre compacto para caber no contexto.
 */
export function buildTools(deps: ToolDependencies) {
  const hostSnapshot = tool(
    async () => {
      const snapshot = await deps.metrics.ensure();
      if (!snapshot) return 'Ainda não há amostras coletadas.';

      const overview = buildOverview(snapshot);

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
        'Métricas ATUAIS do servidor (CPU, memória, swap, load, disco, rede, uptime) e resumo de todos os containers. Use antes de responder qualquer pergunta sobre o estado atual.',
      schema: z.object({}),
    },
  );

  const hostHistory = tool(
    async ({ metric, minutes }) => {
      const rangeSeconds = minutes * 60;
      const stepSeconds = Math.max(60, Math.round(rangeSeconds / 30));
      const points = await deps.history.series(metric, rangeSeconds, stepSeconds);

      if (points.length === 0) {
        return `Não há histórico de ${metric} nos últimos ${minutes} minutos.`;
      }

      const values = points
        .map((point) => point.value)
        .filter((value): value is number => value !== null);

      return json({
        metric,
        windowMinutes: minutes,
        from: points[0]?.ts,
        to: points.at(-1)?.ts,
        samples: values.length,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        avg: values.length
          ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
          : null,
        series: points.slice(-30),
      });
    },
    {
      name: 'host_history',
      description:
        'Série histórica agregada de uma métrica do host. Use para perguntas de tendência ("como estava a CPU na última hora?", "teve pico de memória?").',
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
      const snapshot = await deps.metrics.ensure();
      if (!snapshot) return 'Ainda não há amostras coletadas.';
      if (snapshot.containers.length === 0) {
        return 'Nenhum container visível (o socket do Docker pode estar indisponível).';
      }

      const overview = buildOverview(snapshot);

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
        'Lista todos os containers com CPU, memória, estado de saúde e o UUID do app no Coolify. Use para "quais containers estão rodando" ou "qual consome mais RAM".',
      schema: z.object({}),
    },
  );

  const containerLogs = tool(
    async ({ name, lines }) => {
      const snapshot = await deps.metrics.ensure();
      const containers = snapshot ? buildOverview(snapshot).containers : [];

      const container = containers.find(
        (item) =>
          item.displayName === name ||
          item.name === name ||
          item.id.startsWith(name) ||
          item.displayName.includes(name),
      );

      if (!container) {
        const available = containers.map((item) => item.displayName).join(', ') || 'nenhum';
        return `Container "${name}" não encontrado. Disponíveis: ${available}`;
      }

      const raw = await deps.docker.logs(container.id, lines);
      if (raw === null) return `Não foi possível ler os logs de "${container.displayName}".`;

      return truncate(sanitizeSecrets(raw), 6000);
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
        'Inventário do Coolify: aplicações, bancos e servidores, com status e domínio. Use para perguntas sobre projetos e deploys.',
      schema: z.object({}),
    },
  );

  return [hostSnapshot, hostHistory, listContainers, containerLogs, coolifyInventory];
}
