import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { FastifyReply } from 'fastify';

import { CheckHealthUseCase } from '../../application/use-cases/check-health.use-case.js';

@ApiTags('health')
@Controller('health')
@AllowAnonymous()
export class HealthController {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  /** Alias de `/health/ready` (compatibilidade com o que já existia). */
  @Get()
  async check(@Res({ passthrough: true }) reply: FastifyReply) {
    return this.respond(reply, true);
  }

  /** Liveness: só confirma que o processo responde. Usado pelo HEALTHCHECK do Docker. */
  @Get('live')
  async live(@Res({ passthrough: true }) reply: FastifyReply) {
    return this.respond(reply, false);
  }

  /** Readiness: processo + dependências. Usado pelo Coolify/Traefik. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    return this.respond(reply, true);
  }

  private async respond(reply: FastifyReply, includeDependencies: boolean) {
    const report = await this.checkHealth.execute({ includeDependencies });

    reply.status(report.status === 'ok' ? 200 : 503);

    return report;
  }
}
