import { Controller, Header, type MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { concatMap, from, map, type Observable, timer } from 'rxjs';

import { GetOverviewUseCase } from '../../application/use-cases/get-overview.use-case.js';

const TICK_MS = 5000;

@ApiTags('events')
@ApiBearerAuth()
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly getOverview: GetOverviewUseCase) {}

  /**
   * SSE com o snapshot atual a cada 5s.
   * O tick curto também serve de heartbeat contra o timeout de ~100s
   * do Cloudflare em conexões ociosas.
   */
  @Sse('stream')
  @Header('Cache-Control', 'no-store')
  stream(): Observable<MessageEvent> {
    return timer(0, TICK_MS).pipe(
      concatMap(() => from(this.getOverview.execute())),
      map(
        (overview) =>
          ({
            type: 'metrics',
            data: overview ?? { collectedAt: null },
          }) satisfies MessageEvent,
      ),
    );
  }
}
