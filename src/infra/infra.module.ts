import { Global, Module } from '@nestjs/common';

import { AppSettingsPort } from '../domain/ports/app-settings.port.js';
import { ContainerRuntimePort } from '../domain/ports/container-runtime.port.js';
import { ConversationRepositoryPort } from '../domain/ports/conversation-repository.port.js';
import { CoolifyPort } from '../domain/ports/coolify.port.js';
import { HEALTH_PROBES } from '../domain/ports/health-probe.port.js';
import { HostMetricsPort } from '../domain/ports/host-metrics.port.js';
import { MetricsRepositoryPort } from '../domain/ports/metrics-repository.port.js';
import { SnapshotStorePort } from '../domain/ports/snapshot-store.port.js';
import { UserRepositoryPort } from '../domain/ports/user-repository.port.js';
import { InMemorySnapshotStore } from './cache/in-memory-snapshot.store.js';
import { CoolifyHttpAdapter } from './coolify/coolify-http.adapter.js';
import { DatabaseModule } from './database/database.module.js';
import { DrizzleConversationsRepository } from './database/repositories/drizzle-conversations.repository.js';
import { DrizzleMetricsRepository } from './database/repositories/drizzle-metrics.repository.js';
import { DrizzleUserRepository } from './database/repositories/drizzle-user.repository.js';
import { DockerHttpAdapter } from './docker/docker-http.adapter.js';
import { EnvAppSettingsAdapter } from './health/env-app-settings.adapter.js';
import { DatabaseHealthProbe, ProcessHealthProbe } from './health/health.probes.js';
import { ProcHostMetricsAdapter } from './host/proc-host-metrics.adapter.js';

const ADAPTERS = [
  { provide: HostMetricsPort, useClass: ProcHostMetricsAdapter },
  { provide: ContainerRuntimePort, useClass: DockerHttpAdapter },
  { provide: CoolifyPort, useClass: CoolifyHttpAdapter },
  { provide: MetricsRepositoryPort, useClass: DrizzleMetricsRepository },
  { provide: SnapshotStorePort, useClass: InMemorySnapshotStore },
  { provide: ConversationRepositoryPort, useClass: DrizzleConversationsRepository },
  { provide: UserRepositoryPort, useClass: DrizzleUserRepository },
  { provide: AppSettingsPort, useClass: EnvAppSettingsAdapter },
];

const PROBES = [DatabaseHealthProbe, ProcessHealthProbe];

/**
 * Composition root dos adapters: liga cada port do domínio a uma
 * implementação concreta. É o único lugar que conhece as duas pontas.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    ...ADAPTERS,
    ...PROBES,
    {
      provide: HEALTH_PROBES,
      useFactory: (...probes: unknown[]) => probes,
      inject: PROBES,
    },
  ],
  exports: [...ADAPTERS.map((adapter) => adapter.provide), HEALTH_PROBES],
})
export class InfraModule {}
