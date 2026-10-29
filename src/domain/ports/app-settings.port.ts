/** Configuração exposta ao diagnóstico (sem vazar segredos). */
export interface AppSettings {
  hostProcPath: string;
  hostSysPath: string;
  hostRootPath: string;
  dockerProxyUrl: string;
  metricsIntervalMs: number;
  retentionDays: number;
  llmProvider: string;
  llmModel: string;
}

export abstract class AppSettingsPort {
  abstract get(): AppSettings;
}
