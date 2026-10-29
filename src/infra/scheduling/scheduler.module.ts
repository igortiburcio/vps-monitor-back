import { Module } from '@nestjs/common';

import { ApplicationModule } from '../../application/application.module.js';
import { MetricsScheduler } from './metrics.scheduler.js';

/** Agendamentos: coleta periódica e retenção. */
@Module({
  imports: [ApplicationModule],
  providers: [MetricsScheduler],
})
export class SchedulerModule {}
