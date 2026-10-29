import { Injectable } from '@nestjs/common';

import type { ContainerSnapshot } from '../../domain/entities/container.js';
import { SnapshotStorePort } from '../../domain/ports/snapshot-store.port.js';
import { CollectMetricsUseCase } from './collect-metrics.use-case.js';

export interface ContainersResult {
  collectedAt: string | null;
  containers: ContainerSnapshot[];
}

@Injectable()
export class ListContainersUseCase {
  constructor(
    private readonly store: SnapshotStorePort,
    private readonly collect: CollectMetricsUseCase,
  ) {}

  async execute(): Promise<ContainersResult> {
    if (!this.store.latest()) {
      await this.collect.execute();
    }

    const snapshot = this.store.latest();

    return {
      collectedAt: snapshot?.collectedAt.toISOString() ?? null,
      containers: snapshot?.containers ?? [],
    };
  }
}
