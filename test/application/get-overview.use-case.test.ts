import { describe, expect, it } from 'bun:test';

import { CollectMetricsUseCase } from '../../src/application/use-cases/collect-metrics.use-case.js';
import { GetOverviewUseCase } from '../../src/application/use-cases/get-overview.use-case.js';
import {
  aContainer,
  aHostMetrics,
  anInventory,
  aSnapshot,
  FakeContainerRuntime,
  FakeCoolify,
  FakeHostMetricsProvider,
  InMemoryMetricsRepository,
  InMemorySnapshotStore,
} from '../fakes/index.js';

function setup() {
  const store = new InMemorySnapshotStore();
  const host = new FakeHostMetricsProvider();
  const collect = new CollectMetricsUseCase(
    host,
    new FakeContainerRuntime(),
    new FakeCoolify(),
    new InMemoryMetricsRepository(),
    store,
  );

  return { useCase: new GetOverviewUseCase(store, collect), store, host };
}

describe('GetOverviewUseCase', () => {
  it('usa o snapshot existente sem coletar de novo', async () => {
    const { useCase, store, host } = setup();
    store.push(aSnapshot());

    const overview = await useCase.execute();

    expect(host.calls).toBe(0);
    expect(overview?.collectedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('coleta quando não há snapshot', async () => {
    const { useCase, host } = setup();

    const overview = await useCase.execute();

    expect(host.calls).toBe(1);
    expect(overview).not.toBeNull();
  });

  it('calcula os percentuais de memória e disco', async () => {
    const { useCase, store } = setup();
    store.push(
      aSnapshot({
        host: aHostMetrics({
          memUsed: 2_000,
          memTotal: 8_000,
          diskUsed: 25_000,
          diskTotal: 100_000,
        }),
      }),
    );

    const overview = await useCase.execute();

    expect(overview?.host.memPct).toBe(25);
    expect(overview?.host.diskPct).toBe(25);
  });

  it('resolve o nome amigável do container pelo uuid do Coolify', async () => {
    const { useCase, store } = setup();
    store.push(
      aSnapshot({
        containers: [aContainer({ name: 'abc123-1', coolifyUuid: 'uuid-1' })],
        coolify: anInventory({
          databases: [
            {
              uuid: 'uuid-1',
              name: 'postgres-prod',
              type: 'postgres',
              status: 'running',
              isPublic: false,
              image: null,
            },
          ],
        }),
      }),
    );

    const overview = await useCase.execute();

    expect(overview?.containers[0]?.displayName).toBe('postgres-prod');
  });

  it('mantém o nome do container quando não há correspondência', async () => {
    const { useCase, store } = setup();
    store.push(aSnapshot({ containers: [aContainer({ name: 'orfaozinho', coolifyUuid: null })] }));

    const overview = await useCase.execute();

    expect(overview?.containers[0]?.displayName).toBe('orfaozinho');
  });
});
