import { Module } from '@nestjs/common';

import { ContainersController } from './containers.controller.js';
import { CoolifyController } from './coolify.controller.js';
import { DiagnosticsController } from './diagnostics.controller.js';
import { EventsController } from './events.controller.js';
import { HostController } from './host.controller.js';
import { OverviewController } from './overview.controller.js';

@Module({
  controllers: [
    OverviewController,
    HostController,
    ContainersController,
    CoolifyController,
    DiagnosticsController,
    EventsController,
  ],
})
export class ApiModule {}
