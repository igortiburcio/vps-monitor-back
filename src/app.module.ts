import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { ApplicationModule } from './application/application.module.js';
import { DomainErrorFilter } from './http/filters/domain-error.filter.js';
import { HttpModule } from './http/http.module.js';
import { AiModule } from './infra/ai/ai.module.js';
import { auth } from './infra/auth/better-auth.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { InfraModule } from './infra/infra.module.js';
import { SchedulerModule } from './infra/scheduling/scheduler.module.js';

/**
 * Composition root da aplicação.
 * Aqui só há imports e bindings globais — nenhuma regra de negócio.
 */
@Module({
  imports: [
    DatabaseModule,
    InfraModule,
    ApplicationModule,
    AiModule,
    SchedulerModule,
    HttpModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule.forRoot({ auth }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
