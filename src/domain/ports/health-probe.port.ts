export type ProbeStatus = 'up' | 'down';

export interface ProbeResult {
  name: string;
  status: ProbeStatus;
  responseTimeMs?: number;
  message?: string;
  data?: Record<string, unknown>;
}

/** Porta de saída: verificação de saúde de uma dependência. */
export abstract class HealthProbePort {
  abstract readonly name: string;
  abstract probe(): Promise<ProbeResult>;
}

/** Token para injetar a lista de probes no caso de uso. */
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
