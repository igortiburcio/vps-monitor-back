import { describe, expect, it } from 'bun:test';

import { PruneMetricsUseCase } from '../../src/application/use-cases/prune-metrics.use-case.js';
import { InMemoryMetricsRepository } from '../fakes/index.js';

const DAY_MS = 86_400_000;

describe('PruneMetricsUseCase', () => {
  it('usa a política de retenção informada', async () => {
    const repository = new InMemoryMetricsRepository();
    const useCase = new PruneMetricsUseCase(repository);

    await useCase.execute({ hostDays: 10, containersDays: 3 });

    expect(repository.pruned).not.toBeNull();

    const hostDiffDays = (Date.now() - (repository.pruned?.hostBefore.getTime() ?? 0)) / DAY_MS;
    const containerDiffDays =
      (Date.now() - (repository.pruned?.containersBefore.getTime() ?? 0)) / DAY_MS;

    expect(Math.round(hostDiffDays)).toBe(10);
    expect(Math.round(containerDiffDays)).toBe(3);
  });

  it('usa o padrão quando não recebe política', async () => {
    const repository = new InMemoryMetricsRepository();

    await new PruneMetricsUseCase(repository).execute();

    const hostDiffDays = (Date.now() - (repository.pruned?.hostBefore.getTime() ?? 0)) / DAY_MS;

    expect(Math.round(hostDiffDays)).toBe(30);
  });
});
