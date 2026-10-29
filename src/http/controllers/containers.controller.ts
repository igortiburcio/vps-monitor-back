import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetContainerUseCase } from '../../application/use-cases/get-container.use-case.js';
import { GetContainerLogsUseCase } from '../../application/use-cases/get-container-logs.use-case.js';
import { ListContainersUseCase } from '../../application/use-cases/list-containers.use-case.js';
import { type LogsQuery, logsQuerySchema } from '../dto/query.schema.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';

@ApiTags('containers')
@ApiBearerAuth()
@Controller('api/v1/containers')
export class ContainersController {
  constructor(
    private readonly listContainers: ListContainersUseCase,
    private readonly getContainer: GetContainerUseCase,
    private readonly getContainerLogs: GetContainerLogsUseCase,
  ) {}

  @Get()
  async list() {
    return this.listContainers.execute();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.getContainer.execute(id);
  }

  @Get(':id/logs')
  async logs(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(logsQuerySchema)) query: LogsQuery,
  ) {
    return this.getContainerLogs.execute(id, query.lines);
  }
}
