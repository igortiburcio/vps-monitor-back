import { Injectable, Logger } from '@nestjs/common';

import type { ContainerSnapshot } from '../../domain/entities/container.js';
import type { MetricsSnapshot } from '../../domain/entities/metrics-snapshot.js';
import { ContainerRuntimePort } from '../../domain/ports/container-runtime.port.js';
import { CoolifyPort } from '../../domain/ports/coolify.port.js';
import { HostMetricsPort } from '../../domain/ports/host-metrics.port.js';
import { MetricsRepositoryPort } from '../../domain/ports/metrics-repository.port.js';
import { SnapshotStorePort } from '../../domain/ports/snapshot-store.port.js';

/**
 * Coleta host + containers + Coolify, guarda no cache em memória
 * e persiste para o histórico. Resiliência: falha de um provider não
 * derruba a coleta inteira.
 */
@Injectable()
export class CollectMetricsUseCase {
  private readonly logger = new Logger(CollectMetricsUseCase.name);
  private collecting = false;

  constructor(
    private readonly host: HostMetricsPort,
    private readonly containers: ContainerRuntimePort,
    private readonly coolify: CoolifyPort,
    private readonly repository: MetricsRepositoryPort,
    private readonly store: SnapshotStorePort,
  ) {}

  async execute(): Promise<void> {
    // evita coleta concorrente (tick do scheduler + request do app)
    if (this.collecting) return;
    this.collecting = true;

    try {
      const host = await this.host.sample();
      const [containers, coolify] = await Promise.all([
        this.collectContainers(),
        this.coolify.inventory(),
      ]);

      const snapshot: MetricsSnapshot = {
        collectedAt: new Date(),
        host,
        containers,
        coolify,
      };

      this.store.push(snapshot);
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
    const containers = await this.containers.list();

    return Promise.all(
      containers.map(async (container) => ({
        ...container,
        stats: container.state === 'running' ? await this.containers.stats(container.id) : null,
      })),
    );
  }

  private async persist(snapshot: MetricsSnapshot): Promise<void> {
    // Regra de aplicação: amostra sem host disponível não vira histórico.
    if (snapshot.host.available) {
      await this.repository.saveHost(snapshot.host);
    }

    await this.repository.saveContainers(snapshot.collectedAt, snapshot.containers);
  }
}
