import { Module } from '@nestjs/common';

import { CheckHealthUseCase } from './use-cases/check-health.use-case.js';
import { CollectMetricsUseCase } from './use-cases/collect-metrics.use-case.js';
import {
  GetConversationUseCase,
  ListConversationsUseCase,
} from './use-cases/conversations.use-cases.js';
import { CreateUserUseCase } from './use-cases/create-user.use-case.js';
import { GetContainerUseCase } from './use-cases/get-container.use-case.js';
import { GetContainerLogsUseCase } from './use-cases/get-container-logs.use-case.js';
import { GetCoolifyInventoryUseCase } from './use-cases/get-coolify-inventory.use-case.js';
import { GetHostHistoryUseCase } from './use-cases/get-host-history.use-case.js';
import { GetOverviewUseCase } from './use-cases/get-overview.use-case.js';
import { ListContainersUseCase } from './use-cases/list-containers.use-case.js';
import { PruneMetricsUseCase } from './use-cases/prune-metrics.use-case.js';

const USE_CASES = [
  CollectMetricsUseCase,
  GetOverviewUseCase,
  GetHostHistoryUseCase,
  ListContainersUseCase,
  GetContainerUseCase,
  GetContainerLogsUseCase,
  GetCoolifyInventoryUseCase,
  ListConversationsUseCase,
  GetConversationUseCase,
  PruneMetricsUseCase,
  CheckHealthUseCase,
  CreateUserUseCase,
];

/**
 * Casos de uso. Dependem apenas de ports (domínio) — a ligação com
 * adapters concretos acontece no InfraModule.
 */
@Module({
  providers: [...USE_CASES],
  exports: [...USE_CASES],
})
export class ApplicationModule {}
