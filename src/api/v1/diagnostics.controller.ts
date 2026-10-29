import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CoolifyService } from '../../collectors/coolify/coolify.service.js';
import { DockerService } from '../../collectors/docker/docker.service.js';
import { HostService } from '../../collectors/host/host.service.js';
import { env } from '../../config/env.js';

/**
 * Estado de cada coletor. Existe para responder "por que a seção X está vazia?"
 * sem precisar entrar no container.
 */
@ApiTags('diagnostics')
@ApiBearerAuth()
@Controller('api/v1/diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly host: HostService,
    private readonly docker: DockerService,
    private readonly coolify: CoolifyService,
  ) {}

  @Get()
  async check() {
    const hostSample = this.host.sample();
    const containers = await this.docker.listContainers();
    const coolify = await this.coolify.probe();

    return {
      host: {
        procPath: env.HOST_PROC,
        sysPath: env.HOST_SYS,
        rootPath: env.HOST_ROOT,
        available: hostSample.available,
      },
      docker: {
        url: env.DOCKER_PROXY_URL,
        reachable: containers.length > 0,
        containers: containers.length,
      },
      coolify,
      llm: {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
        configured: Boolean(env.GROQ_API_KEY ?? env.DEEPSEEK_API_KEY),
      },
      metrics: {
        intervalMs: env.METRICS_INTERVAL_MS,
        retentionDays: env.METRICS_RETENTION_DAYS,
      },
    };
  }
}
