import { Controller, Header, type MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { map, type Observable, timer } from 'rxjs';

import { MetricsService } from '../../metrics/metrics.service.js';
import { buildOverview } from './overview.mapper.js';

const TICK_MS = 5000;

@ApiTags('events')
@ApiBearerAuth()
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * SSE com o snapshot atual a cada 5s.
   * O tick curto também serve de heartbeat contra o timeout de ~100s
   * do Cloudflare em conexões ociosas.
   */
  @Sse('stream')
  @Header('Cache-Control', 'no-store')
  stream(): Observable<MessageEvent> {
    return timer(0, TICK_MS).pipe(
      map(() => {
        const snapshot = this.metrics.latest();

        return {
          type: 'metrics',
          data: snapshot ? buildOverview(snapshot) : { collectedAt: null },
        } satisfies MessageEvent;
      }),
    );
  }
}
