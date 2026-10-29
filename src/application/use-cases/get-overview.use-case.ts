import { Injectable } from '@nestjs/common';

import { SnapshotStorePort } from '../../domain/ports/snapshot-store.port.js';
import type { Overview } from '../dto/overview.dto.js';
import { toOverview } from '../mappers/overview.mapper.js';
import { CollectMetricsUseCase } from './collect-metrics.use-case.js';

@Injectable()
export class GetOverviewUseCase {
  constructor(
    private readonly store: SnapshotStorePort,
    private readonly collect: CollectMetricsUseCase,
  ) {}

  /** Retorna o último retrato; se não houver, coleta na hora. */
  async execute(): Promise<Overview | null> {
    if (!this.store.latest()) {
      await this.collect.execute();
    }

    const snapshot = this.store.latest();

    return snapshot ? toOverview(snapshot) : null;
  }
}
