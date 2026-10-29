import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { DockerService } from '../../collectors/docker/docker.service.js';
import { sanitizeSecrets, truncate } from '../../common/sanitize.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import { type LogsQuery, logsQuerySchema } from './dto/query.schema.js';

@ApiTags('containers')
@ApiBearerAuth()
@Controller('api/v1/containers')
export class ContainersController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly docker: DockerService,
  ) {}

  @Get()
  async list() {
    const snapshot = await this.metrics.ensure();
    return {
      collectedAt: snapshot?.collectedAt.toISOString() ?? null,
      containers: snapshot?.containers ?? [],
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const snapshot = await this.metrics.ensure();
    const container = snapshot?.containers.find(
      (item) => item.id === id || item.name === id || item.id.startsWith(id),
    );

    if (!container) throw new NotFoundException(`Container "${id}" não encontrado`);

    return container;
  }

  @Get(':id/logs')
  async logs(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(logsQuerySchema)) query: LogsQuery,
  ) {
    const snapshot = await this.metrics.ensure();
    const container = snapshot?.containers.find(
      (item) => item.id === id || item.name === id || item.id.startsWith(id),
    );

    if (!container) throw new NotFoundException(`Container "${id}" não encontrado`);

    const raw = await this.docker.logs(container.id, query.lines);

    if (raw === null) {
      return {
        containerId: container.id,
        name: container.name,
        lines: query.lines,
        available: false,
        logs: '',
      };
    }

    return {
      containerId: container.id,
      name: container.name,
      lines: query.lines,
      available: true,
      logs: truncate(sanitizeSecrets(raw), 20_000),
    };
  }
}
