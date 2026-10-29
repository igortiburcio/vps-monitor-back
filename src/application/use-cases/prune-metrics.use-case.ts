import { Injectable } from '@nestjs/common';

import { DEFAULT_RETENTION, type RetentionPolicy } from '../../domain/entities/retention-policy.js';
import { MetricsRepositoryPort } from '../../domain/ports/metrics-repository.port.js';

const DAY_MS = 86_400_000;

@Injectable()
export class PruneMetricsUseCase {
  constructor(private readonly repository: MetricsRepositoryPort) {}

  async execute(policy: RetentionPolicy = DEFAULT_RETENTION): Promise<void> {
    const now = Date.now();

    await this.repository.prune(
      new Date(now - policy.hostDays * DAY_MS),
      new Date(now - policy.containersDays * DAY_MS),
    );
  }
}
