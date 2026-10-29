import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetCoolifyInventoryUseCase } from '../../application/use-cases/get-coolify-inventory.use-case.js';

@ApiTags('coolify')
@ApiBearerAuth()
@Controller('api/v1/coolify')
export class CoolifyController {
  constructor(private readonly coolify: GetCoolifyInventoryUseCase) {}

  @Get('applications')
  async applications() {
    const inventory = await this.coolify.inventory();

    return { configured: inventory.configured, applications: inventory.applications };
  }

  @Get('databases')
  async databases() {
    const inventory = await this.coolify.inventory();

    return { configured: inventory.configured, databases: inventory.databases };
  }

  @Get('servers')
  async servers() {
    const inventory = await this.coolify.inventory();

    return { configured: inventory.configured, servers: inventory.servers };
  }

  @Get('services')
  async services() {
    const inventory = await this.coolify.inventory();

    return { configured: inventory.configured, services: inventory.services };
  }

  @Get('deployments')
  async deployments() {
    return { deployments: await this.coolify.deployments() };
  }
}
