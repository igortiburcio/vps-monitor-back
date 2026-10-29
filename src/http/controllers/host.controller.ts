import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetHostHistoryUseCase } from '../../application/use-cases/get-host-history.use-case.js';
import { GetOverviewUseCase } from '../../application/use-cases/get-overview.use-case.js';
import { type HistoryQuery, historyQuerySchema } from '../dto/query.schema.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';

@ApiTags('host')
@ApiBearerAuth()
@Controller('api/v1/host')
export class HostController {
  constructor(
    private readonly getOverview: GetOverviewUseCase,
    private readonly getHistory: GetHostHistoryUseCase,
  ) {}

  @Get('current')
  async current() {
    const overview = await this.getOverview.execute();

    return {
      collectedAt: overview?.collectedAt ?? null,
      ...(overview?.host ?? {}),
    };
  }

  @Get('history')
  async series(@Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery) {
    return this.getHistory.execute(query.metric, query.range, query.step);
  }
}
