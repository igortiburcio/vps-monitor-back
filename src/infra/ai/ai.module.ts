import { Module } from '@nestjs/common';

import { ApplicationModule } from '../../application/application.module.js';
import { ChatWithAgentUseCase } from '../../application/use-cases/chat-with-agent.use-case.js';
import { GetDiagnosticsUseCase } from '../../application/use-cases/get-diagnostics.use-case.js';
import { ChatAgentPort } from '../../domain/ports/chat-agent.port.js';
import { LangGraphAgentAdapter } from './langgraph-agent.adapter.js';

/**
 * O adapter do agente depende dos casos de uso (para alimentar as tools),
 * por isso vive num módulo separado do InfraModule — evita ciclo.
 * `GetDiagnosticsUseCase` fica aqui porque precisa do ChatAgentPort.
 */
@Module({
  imports: [ApplicationModule],
  providers: [
    ChatWithAgentUseCase,
    GetDiagnosticsUseCase,
    { provide: ChatAgentPort, useClass: LangGraphAgentAdapter },
  ],
  exports: [ChatAgentPort, ChatWithAgentUseCase, GetDiagnosticsUseCase],
})
export class AiModule {}
