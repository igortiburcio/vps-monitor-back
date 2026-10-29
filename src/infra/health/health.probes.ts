import { Injectable } from '@nestjs/common';

import type { ProbeResult } from '../../domain/ports/health-probe.port.js';
import { HealthProbePort } from '../../domain/ports/health-probe.port.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class DatabaseHealthProbe extends HealthProbePort {
  readonly name = 'database';

  constructor(private readonly database: DatabaseService) {
    super();
  }

  async probe(): Promise<ProbeResult> {
    const startedAt = performance.now();

    await this.database.client`select 1`;

    return {
      name: this.name,
      status: 'up',
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  }
}

@Injectable()
export class ProcessHealthProbe extends HealthProbePort {
  readonly name = 'process';

  probe(): Promise<ProbeResult> {
    return Promise.resolve({
      name: this.name,
      status: 'up',
      data: { uptimeSec: Math.round(process.uptime()) },
    });
  }
}
