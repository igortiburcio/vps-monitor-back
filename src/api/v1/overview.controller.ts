import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { MetricsService } from '../../metrics/metrics.service.js';
import { buildOverview } from './overview.mapper.js';

@ApiTags('overview')
@ApiBearerAuth()
@Controller('api/v1/overview')
export class OverviewController {
  constructor(private readonly metrics: MetricsService) {}

  /** Payload único da home do app: host + containers + Coolify. */
  @Get()
  async overview() {
    const snapshot = await this.metrics.ensure();

    if (!snapshot) {
      throw new ServiceUnavailableException('Nenhuma amostra coletada ainda');
    }

    return buildOverview(snapshot);
  }
}
