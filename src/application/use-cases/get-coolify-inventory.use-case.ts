import { Injectable } from '@nestjs/common';

import type { CoolifyDeployment, CoolifyInventory } from '../../domain/entities/coolify.js';
import { CoolifyPort } from '../../domain/ports/coolify.port.js';

@Injectable()
export class GetCoolifyInventoryUseCase {
  constructor(private readonly coolify: CoolifyPort) {}

  async inventory(): Promise<CoolifyInventory> {
    return this.coolify.inventory();
  }

  async deployments(): Promise<CoolifyDeployment[]> {
    return this.coolify.deployments();
  }
}
