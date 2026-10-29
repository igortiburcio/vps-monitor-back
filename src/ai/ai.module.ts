import { Module } from '@nestjs/common';

import { AgentService } from './agent.service.js';
import { AiController } from './ai.controller.js';
import { ConversationsService } from './conversations.service.js';

@Module({
  controllers: [AiController],
  providers: [AgentService, ConversationsService],
})
export class AiModule {}
