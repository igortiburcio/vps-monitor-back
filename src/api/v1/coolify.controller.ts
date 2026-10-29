import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CoolifyService } from '../../collectors/coolify/coolify.service.js';

@ApiTags('coolify')
@ApiBearerAuth()
@Controller('api/v1/coolify')
export class CoolifyController {
  constructor(private readonly coolify: CoolifyService) {}

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

  @Get('deployments')
  async deployments() {
    const deployments = await this.coolify.deployments();
    return { deployments };
  }
}
