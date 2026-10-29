import { Module } from '@nestjs/common';

import { ApplicationModule } from '../application/application.module.js';
import { AiModule } from '../infra/ai/ai.module.js';
import { AiController } from './controllers/ai.controller.js';
import { ContainersController } from './controllers/containers.controller.js';
import { CoolifyController } from './controllers/coolify.controller.js';
import { DiagnosticsController } from './controllers/diagnostics.controller.js';
import { EventsController } from './controllers/events.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { HostController } from './controllers/host.controller.js';
import { MeController } from './controllers/me.controller.js';
import { OverviewController } from './controllers/overview.controller.js';

@Module({
  imports: [ApplicationModule, AiModule],
  controllers: [
    HealthController,
    MeController,
    OverviewController,
    HostController,
    ContainersController,
    CoolifyController,
    EventsController,
    DiagnosticsController,
    AiController,
  ],
})
export class HttpModule {}
