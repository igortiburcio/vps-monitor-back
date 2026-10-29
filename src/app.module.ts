import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { auth } from './auth/auth.js';
import { MeController } from './auth/me.controller.js';
import { HealthController } from './common/health.controller.js';
import { DatabaseModule } from './db/database.module.js';

@Module({
  imports: [
    DatabaseModule,
    TerminusModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule.forRoot({ auth }),
  ],
  controllers: [HealthController, MeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
