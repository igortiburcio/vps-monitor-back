import { describe, expect, it } from 'bun:test';

import { CollectMetricsUseCase } from '../../src/application/use-cases/collect-metrics.use-case.js';
import { GetContainerUseCase } from '../../src/application/use-cases/get-container.use-case.js';
import { GetContainerLogsUseCase } from '../../src/application/use-cases/get-container-logs.use-case.js';
import { ListContainersUseCase } from '../../src/application/use-cases/list-containers.use-case.js';
import { ContainerNotFoundError } from '../../src/domain/errors/domain.errors.js';
import {
  aContainer,
  aSnapshot,
  FakeContainerRuntime,
  FakeCoolify,
  FakeHostMetricsProvider,
  InMemoryMetricsRepository,
  InMemorySnapshotStore,
} from '../fakes/index.js';

function setup() {
  const store = new InMemorySnapshotStore();
  store.push(
    aSnapshot({
      containers: [
        aContainer({ id: 'aaa111', name: 'pulso-backend-1' }),
        aContainer({ id: 'bbb222', name: 'redis-context' }),
      ],
    }),
  );

  const collect = new CollectMetricsUseCase(
    new FakeHostMetricsProvider(),
    new FakeContainerRuntime(),
    new FakeCoolify(),
    new InMemoryMetricsRepository(),
    store,
  );

  const runtime = new FakeContainerRuntime();
  const list = new ListContainersUseCase(store, collect);
  const get = new GetContainerUseCase(list);
  const logs = new GetContainerLogsUseCase(get, runtime);

  return { logs, runtime };
}

describe('GetContainerLogsUseCase', () => {
  it('mascara segredos nos logs', async () => {
    const { logs, runtime } = setup();
    runtime.logsValue = 'DB_PASSWORD=super-secret\nAuthorization: Bearer abc123';

    const result = await logs.execute('pulso-backend-1', 50);

    expect(result.available).toBe(true);
    expect(result.logs).not.toContain('super-secret');
    expect(result.logs).not.toContain('abc123');
  });

  it('trunca logs muito longos', async () => {
    const { logs, runtime } = setup();
    runtime.logsValue = 'x'.repeat(25_000);

    const result = await logs.execute('pulso-backend-1', 50);

    expect(result.logs).toContain('truncado');
    expect(result.logs.length).toBeLessThan(25_000);
  });

  it('sinaliza indisponível quando o runtime não responde', async () => {
    const { logs, runtime } = setup();
    runtime.logsValue = null;

    const result = await logs.execute('pulso-backend-1', 50);

    expect(result.available).toBe(false);
    expect(result.logs).toBe('');
  });

  it('lança ContainerNotFoundError quando não encontra', async () => {
    const { logs } = setup();

    let captured: unknown;
    try {
      await logs.execute('inexistente', 10);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ContainerNotFoundError);
  });
});
