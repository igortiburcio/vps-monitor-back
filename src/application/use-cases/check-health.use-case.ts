import { Inject, Injectable } from '@nestjs/common';

import type { HealthReport } from '../../domain/entities/health.js';
import {
  HEALTH_PROBES,
  type HealthProbePort,
  type ProbeResult,
} from '../../domain/ports/health-probe.port.js';

/**
 * Agrega todos os probes registrados.
 * `live` ignora dependências: só confirma que o processo respondeu.
 */
@Injectable()
export class CheckHealthUseCase {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: HealthProbePort[]) {}

  async execute(options: { includeDependencies?: boolean } = {}): Promise<HealthReport> {
    const includeDependencies = options.includeDependencies ?? true;
    const probes = includeDependencies
      ? this.probes
      : this.probes.filter((probe) => probe.name === 'process');

    const results = await Promise.all(
      probes.map(async (probe): Promise<ProbeResult> => {
        try {
          return await probe.probe();
        } catch (error) {
          return {
            name: probe.name,
            status: 'down',
            message: error instanceof Error ? error.message : 'erro desconhecido',
          };
        }
      }),
    );

    const info: Record<string, ProbeResult> = {};
    const failed: Record<string, ProbeResult> = {};

    for (const result of results) {
      if (result.status === 'up') info[result.name] = result;
      else failed[result.name] = result;
    }

    return {
      status: Object.keys(failed).length === 0 ? 'ok' : 'error',
      info,
      error: failed,
      details: { ...info, ...failed },
    };
  }
}
