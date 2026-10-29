import { Injectable } from '@nestjs/common';

import { type AppSettings, AppSettingsPort } from '../../domain/ports/app-settings.port.js';
import { env } from '../config/env.js';

@Injectable()
export class EnvAppSettingsAdapter extends AppSettingsPort {
  get(): AppSettings {
    return {
      hostProcPath: env.HOST_PROC,
      hostSysPath: env.HOST_SYS,
      hostRootPath: env.HOST_ROOT,
      dockerProxyUrl: env.DOCKER_PROXY_URL,
      metricsIntervalMs: env.METRICS_INTERVAL_MS,
      retentionDays: env.METRICS_RETENTION_DAYS,
      llmProvider: env.LLM_PROVIDER,
      llmModel: env.LLM_MODEL,
    };
  }
}
