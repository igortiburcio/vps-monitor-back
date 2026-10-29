import { Injectable } from '@nestjs/common';

import { ContainerRuntimePort } from '../../domain/ports/container-runtime.port.js';
import { sanitizeSecrets, truncate } from '../../domain/sanitization.js';
import { GetContainerUseCase } from './get-container.use-case.js';

const MAX_LOG_CHARS = 20_000;

export interface ContainerLogsResult {
  containerId: string;
  name: string;
  lines: number;
  available: boolean;
  logs: string;
}

@Injectable()
export class GetContainerLogsUseCase {
  constructor(
    private readonly getContainer: GetContainerUseCase,
    private readonly runtime: ContainerRuntimePort,
  ) {}

  async execute(identifier: string, lines: number): Promise<ContainerLogsResult> {
    const container = await this.getContainer.execute(identifier);
    const raw = await this.runtime.logs(container.id, lines);

    if (raw === null) {
      return {
        containerId: container.id,
        name: container.name,
        lines,
        available: false,
        logs: '',
      };
    }

    return {
      containerId: container.id,
      name: container.name,
      lines,
      available: true,
      logs: truncate(sanitizeSecrets(raw), MAX_LOG_CHARS),
    };
  }
}
