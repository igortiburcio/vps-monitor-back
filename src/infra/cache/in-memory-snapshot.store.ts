import { Injectable } from '@nestjs/common';

import type { MetricsSnapshot } from '../../domain/entities/metrics-snapshot.js';
import { SnapshotStorePort } from '../../domain/ports/snapshot-store.port.js';

/** Amostras mantidas em memória para respostas instantâneas. */
const RING_SIZE = 240;

@Injectable()
export class InMemorySnapshotStore extends SnapshotStorePort {
  private readonly ring: MetricsSnapshot[] = [];

  push(snapshot: MetricsSnapshot): void {
    this.ring.push(snapshot);

    if (this.ring.length > RING_SIZE) this.ring.shift();
  }

  latest(): MetricsSnapshot | null {
    return this.ring.at(-1) ?? null;
  }

  recent(limit: number): MetricsSnapshot[] {
    return this.ring.slice(-limit);
  }
}
