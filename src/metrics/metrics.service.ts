import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { lt } from 'drizzle-orm';

import { type CoolifyInventory, CoolifyService } from '../collectors/coolify/coolify.service.js';
import {
  type DockerContainer,
  DockerService,
  type DockerStats,
} from '../collectors/docker/docker.service.js';
import { type HostSample, HostService } from '../collectors/host/host.service.js';
import { env } from '../config/env.js';
import { DatabaseService } from '../db/database.service.js';
import { containerSamples, metricSamples } from '../db/schema.js';

export interface ContainerSnapshot extends DockerContainer {
  stats: DockerStats | null;
}

export interface MetricsSnapshot {
  collectedAt: Date;
  host: HostSample;
  containers: ContainerSnapshot[];
  coolify: CoolifyInventory;
}

/** Amostras mantidas em memória para respostas instantâneas. */
const RING_SIZE = 240;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly ring: MetricsSnapshot[] = [];
  private collectTimer: ReturnType<typeof setInterval> | null = null;
  private retentionTimer: ReturnType<typeof setInterval> | null = null;
  private collecting = false;

  constructor(
    private readonly host: HostService,
    private readonly docker: DockerService,
    private readonly coolify: CoolifyService,
    private readonly database: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collect();

    this.collectTimer = setInterval(() => {
      void this.collect();
    }, env.METRICS_INTERVAL_MS);

    this.retentionTimer = setInterval(() => {
      void this.prune();
    }, RETENTION_INTERVAL_MS);

    this.logger.log(`coleta a cada ${env.METRICS_INTERVAL_MS}ms`);
  }

  onModuleDestroy(): void {
    if (this.collectTimer) clearInterval(this.collectTimer);
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  latest(): MetricsSnapshot | null {
    return this.ring.at(-1) ?? null;
  }

  /** Garante que existe ao menos uma amostra (primeiro request após o boot). */
  async ensure(): Promise<MetricsSnapshot | null> {
    if (!this.latest()) await this.collect();
    return this.latest();
  }

  /** Últimas amostras em memória (ordem cronológica). */
  recent(limit = 60): MetricsSnapshot[] {
    return this.ring.slice(-limit);
  }

  async collect(): Promise<void> {
    if (this.collecting) return;
    this.collecting = true;

    try {
      const hostSample = this.host.sample();
      const [containers, coolify] = await Promise.all([
        this.collectContainers(),
        this.coolify.inventory(),
      ]);

      const snapshot: MetricsSnapshot = {
        collectedAt: new Date(),
        host: hostSample,
        containers,
        coolify,
      };

      this.ring.push(snapshot);
      if (this.ring.length > RING_SIZE) this.ring.shift();

      await this.persist(snapshot);
    } catch (error) {
      this.logger.error(
        `falha na coleta: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    } finally {
      this.collecting = false;
    }
  }

  private async collectContainers(): Promise<ContainerSnapshot[]> {
    const containers = await this.docker.listContainers();

    const stats = await Promise.all(
      containers.map(async (container) => ({
        container,
        stats: container.state === 'running' ? await this.docker.stats(container.id) : null,
      })),
    );

    return stats.map(({ container, stats: containerStats }) => ({
      ...container,
      stats: containerStats,
    }));
  }

  private async persist(snapshot: MetricsSnapshot): Promise<void> {
    const { host, containers } = snapshot;

    if (host.available) {
      await this.database.db.insert(metricSamples).values({
        ts: host.ts,
        cpuPct: host.cpuPct,
        cpuPerCore: host.cpuPerCore,
        memUsed: host.memUsed,
        memTotal: host.memTotal,
        swapUsed: host.swapUsed,
        load1: host.load1,
        load5: host.load5,
        load15: host.load15,
        diskUsed: host.diskUsed,
        diskTotal: host.diskTotal,
        netRxBps: host.netRxBps,
        netTxBps: host.netTxBps,
        uptimeSec: host.uptimeSec,
        tempC: host.tempC,
      });
    }

    if (containers.length > 0) {
      await this.database.db.insert(containerSamples).values(
        containers.map((container) => ({
          ts: snapshot.collectedAt,
          containerId: container.id,
          name: container.name,
          coolifyUuid: container.coolifyUuid,
          cpuPct: container.stats?.cpuPct ?? null,
          memUsed: container.stats?.memUsed ?? null,
          memLimit: container.stats?.memLimit ?? null,
          netRx: container.stats?.netRx ?? null,
          netTx: container.stats?.netTx ?? null,
          blockRead: container.stats?.blockRead ?? null,
          blockWrite: container.stats?.blockWrite ?? null,
          status: container.state,
          health: container.health,
        })),
      );
    }
  }

  private async prune(): Promise<void> {
    const metricsCutoff = new Date(Date.now() - env.METRICS_RETENTION_DAYS * 86_400_000);
    const containersCutoff = new Date(Date.now() - 7 * 86_400_000);

    try {
      await this.database.db.delete(metricSamples).where(lt(metricSamples.ts, metricsCutoff));
      await this.database.db
        .delete(containerSamples)
        .where(lt(containerSamples.ts, containersCutoff));

      this.logger.log('retenção aplicada');
    } catch (error) {
      this.logger.error(
        `falha na retenção: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }
}
