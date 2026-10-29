import { Global, Module } from '@nestjs/common';

import { CoolifyService } from './coolify/coolify.service.js';
import { DockerService } from './docker/docker.service.js';
import { HostService } from './host/host.service.js';

@Global()
@Module({
  providers: [HostService, DockerService, CoolifyService],
  exports: [HostService, DockerService, CoolifyService],
})
export class CollectorsModule {}
