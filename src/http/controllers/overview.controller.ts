import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetOverviewUseCase } from '../../application/use-cases/get-overview.use-case.js';

@ApiTags('overview')
@ApiBearerAuth()
@Controller('api/v1/overview')
export class OverviewController {
  constructor(private readonly getOverview: GetOverviewUseCase) {}

  /** Payload único da home do app: host + containers + Coolify. */
  @Get()
  async overview() {
    const overview = await this.getOverview.execute();

    if (!overview) {
      throw new ServiceUnavailableException('Nenhuma amostra coletada ainda');
    }

    return overview;
  }
}
