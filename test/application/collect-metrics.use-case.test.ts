import { describe, expect, it } from 'bun:test';

import { CollectMetricsUseCase } from '../../src/application/use-cases/collect-metrics.use-case.js';
import type { ContainerInfo } from '../../src/domain/entities/container.js';
import type { CoolifyInventory } from '../../src/domain/entities/coolify.js';
import { CoolifyPort } from '../../src/domain/ports/coolify.port.js';
import {
  aContainer,
  aHostMetrics,
  anInventory,
  FakeContainerRuntime,
  FakeCoolify,
  FakeHostMetricsProvider,
  InMemoryMetricsRepository,
  InMemorySnapshotStore,
} from '../fakes/index.js';

function setup(hostValue = aHostMetrics()) {
  const host = new FakeHostMetricsProvider(hostValue);
  const runtime = new FakeContainerRuntime();
  const coolify = new FakeCoolify();
  const repository = new InMemoryMetricsRepository();
  const store = new InMemorySnapshotStore();

  const useCase = new CollectMetricsUseCase(host, runtime, coolify, repository, store);

  return { useCase, host, runtime, coolify, repository, store };
}

const runningContainer: ContainerInfo = {
  id: 'abc',
  name: 'api-123',
  image: 'nginx',
  state: 'running',
  status: 'Up',
  health: 'healthy',
  coolifyUuid: null,
};

describe('CollectMetricsUseCase', () => {
  it('persiste a amostra do host e a dos containers', async () => {
    const { useCase, runtime, repository } = setup();
    runtime.containers = [runningContainer];

    await useCase.execute();

    expect(repository.hostSamples).toHaveLength(1);
    expect(repository.containerBatches).toHaveLength(1);
    expect(repository.containerBatches[0]?.containers).toHaveLength(1);
  });

  it('não persiste host quando a métrica está indisponível', async () => {
    const { useCase, repository } = setup(aHostMetrics({ available: false }));

    await useCase.execute();

    expect(repository.hostSamples).toHaveLength(0);
    expect(repository.containerBatches).toHaveLength(1);
  });

  it('não coleta stats de container parado', async () => {
    const { useCase, runtime } = setup();
    runtime.containers = [{ ...runningContainer, state: 'exited' }];

    await useCase.execute();

    expect(runtime.statsCalls).toBe(0);
  });

  it('guarda o snapshot no cache em memória', async () => {
    const { useCase, store } = setup();

    await useCase.execute();

    expect(store.latest()).not.toBeNull();
    expect(store.latest()?.host.cpuPct).toBe(42);
  });

  it('não derruba a coleta quando um provider falha', async () => {
    const { useCase, repository, store } = setup();
    const failing = new (class extends CoolifyPort {
      async inventory(): Promise<CoolifyInventory> {
        throw new Error('coolify fora');
      }
      async deployments() {
        return [];
      }
      async probe() {
        return { url: null, ok: false, status: null, error: 'x' };
      }
    })();

    const useCaseWithFailure = new CollectMetricsUseCase(
      new FakeHostMetricsProvider(),
      new FakeContainerRuntime(),
      failing,
      repository,
      store,
    );

    await useCaseWithFailure.execute();

    expect(store.latest()).toBeNull();
    expect(repository.hostSamples).toHaveLength(0);
  });

  it('ignora coleta concorrente', async () => {
    const { useCase, repository } = setup();

    await Promise.all([useCase.execute(), useCase.execute()]);

    expect(repository.hostSamples).toHaveLength(1);
  });

  it('anexa o inventário do Coolify ao snapshot', async () => {
    const { useCase, coolify, store } = setup();
    coolify.inventoryValue = anInventory({ configured: true, fetchedAt: new Date() });

    await useCase.execute();

    expect(store.latest()?.coolify.configured).toBe(true);
  });
});
