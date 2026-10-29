import { Injectable } from '@nestjs/common';

import { type AppSettings, AppSettingsPort } from '../../domain/ports/app-settings.port.js';
import { ChatAgentPort } from '../../domain/ports/chat-agent.port.js';
import { ContainerRuntimePort } from '../../domain/ports/container-runtime.port.js';
import { CoolifyPort } from '../../domain/ports/coolify.port.js';
import { HostMetricsPort } from '../../domain/ports/host-metrics.port.js';

export interface Diagnostics {
  host: { procPath: string; sysPath: string; rootPath: string; available: boolean };
  docker: { url: string; reachable: boolean; containers: number };
  coolify: { url: string | null; ok: boolean; status: number | null; error: string | null };
  llm: { provider: string; model: string; configured: boolean };
  metrics: { intervalMs: number; retentionDays: number };
}

@Injectable()
export class GetDiagnosticsUseCase {
  constructor(
    private readonly host: HostMetricsPort,
    private readonly containers: ContainerRuntimePort,
    private readonly coolify: CoolifyPort,
    private readonly agent: ChatAgentPort,
    private readonly settings: AppSettingsPort,
  ) {}

  async execute(): Promise<Diagnostics> {
    const config: AppSettings = this.settings.get();

    const [hostSample, containers, coolify] = await Promise.all([
      this.host.sample(),
      this.containers.list(),
      this.coolify.probe(),
    ]);

    return {
      host: {
        procPath: config.hostProcPath,
        sysPath: config.hostSysPath,
        rootPath: config.hostRootPath,
        available: hostSample.available,
      },
      docker: {
        url: config.dockerProxyUrl,
        reachable: await this.containers.ping(),
        containers: containers.length,
      },
      coolify,
      llm: {
        provider: config.llmProvider,
        model: config.llmModel,
        configured: this.agent.configured,
      },
      metrics: {
        intervalMs: config.metricsIntervalMs,
        retentionDays: config.retentionDays,
      },
    };
  }
}
