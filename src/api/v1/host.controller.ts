import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { HistoryService } from '../../metrics/history.service.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import { type HistoryQuery, historyQuerySchema } from './dto/query.schema.js';

@ApiTags('host')
@ApiBearerAuth()
@Controller('api/v1/host')
export class HostController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly history: HistoryService,
  ) {}

  @Get('current')
  async current() {
    const snapshot = await this.metrics.ensure();

    return {
      collectedAt: snapshot?.collectedAt.toISOString() ?? null,
      ...snapshot?.host,
    };
  }

  @Get('history')
  async series(@Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery) {
    const points = await this.history.series(query.metric, query.range, query.step);

    return {
      metric: query.metric,
      rangeSeconds: query.range,
      stepSeconds: query.step,
      points,
    };
  }
}
