import { Global, Module } from '@nestjs/common';

import { HistoryService } from './history.service.js';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  providers: [MetricsService, HistoryService],
  exports: [MetricsService, HistoryService],
})
export class MetricsModule {}
