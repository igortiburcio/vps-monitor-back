import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { DatabaseService } from '../db/database.service.js';

@ApiTags('health')
@Controller('health')
@AllowAnonymous()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly database: DatabaseService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.indicator
          .check('database')
          .attempt(async () => {
            await this.database.client`select 1`;
          })
          .withTimeout(3000),

      () => this.indicator.check('process').up({ uptimeSec: Math.round(process.uptime()) }),
    ]);
  }
}
