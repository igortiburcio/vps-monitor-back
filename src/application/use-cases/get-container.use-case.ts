import { Injectable } from '@nestjs/common';

import type { ContainerSnapshot } from '../../domain/entities/container.js';
import { ContainerNotFoundError } from '../../domain/errors/domain.errors.js';
import { ListContainersUseCase } from './list-containers.use-case.js';

@Injectable()
export class GetContainerUseCase {
  constructor(private readonly listContainers: ListContainersUseCase) {}

  async execute(identifier: string): Promise<ContainerSnapshot> {
    const { containers } = await this.listContainers.execute();

    const container = containers.find(
      (item) =>
        item.id === identifier || item.name === identifier || item.id.startsWith(identifier),
    );

    if (!container) throw new ContainerNotFoundError(identifier);

    return container;
  }
}
