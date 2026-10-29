import type {
  ContainerInfo,
  ContainerSnapshot,
  ContainerStats,
} from '../../src/domain/entities/container.js';
import type {
  ChatEvent,
  ChatTurn,
  ConversationSummary,
  StoredMessage,
} from '../../src/domain/entities/conversation.js';
import type {
  CoolifyDeployment,
  CoolifyInventory,
  CoolifyProbe,
} from '../../src/domain/entities/coolify.js';
import type { HistoryPoint } from '../../src/domain/entities/history.js';
import type { HistoryMetric } from '../../src/domain/entities/history-metric.js';
import type { HostMetrics } from '../../src/domain/entities/host-metrics.js';
import type { MetricsSnapshot } from '../../src/domain/entities/metrics-snapshot.js';
import type { AppSettings } from '../../src/domain/ports/app-settings.port.js';
import { AppSettingsPort } from '../../src/domain/ports/app-settings.port.js';
import { ChatAgentPort } from '../../src/domain/ports/chat-agent.port.js';
import { ContainerRuntimePort } from '../../src/domain/ports/container-runtime.port.js';
import { ConversationRepositoryPort } from '../../src/domain/ports/conversation-repository.port.js';
import { CoolifyPort } from '../../src/domain/ports/coolify.port.js';
import { HealthProbePort, type ProbeResult } from '../../src/domain/ports/health-probe.port.js';
import { HostMetricsPort } from '../../src/domain/ports/host-metrics.port.js';
import { MetricsRepositoryPort } from '../../src/domain/ports/metrics-repository.port.js';
import { SnapshotStorePort } from '../../src/domain/ports/snapshot-store.port.js';
import {
  type CreateUserInput,
  UserRepositoryPort,
} from '../../src/domain/ports/user-repository.port.js';

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function aHostMetrics(overrides: Partial<HostMetrics> = {}): HostMetrics {
  return {
    ts: new Date('2026-01-01T00:00:00.000Z'),
    available: true,
    cpuPct: 42,
    cpuPerCore: [40, 44],
    memUsed: 3_000,
    memTotal: 8_000,
    swapUsed: 0,
    load1: 1.5,
    load5: 1.2,
    load15: 1.1,
    diskUsed: 20_000,
    diskTotal: 100_000,
    netRxBps: 1_000,
    netTxBps: 500,
    uptimeSec: 90_000,
    tempC: 45,
    ...overrides,
  };
}

export function aContainer(overrides: Partial<ContainerSnapshot> = {}): ContainerSnapshot {
  return {
    id: 'abc123def456',
    name: 'api-123',
    image: 'nginx:alpine',
    state: 'running',
    status: 'Up 2 hours',
    health: 'healthy',
    coolifyUuid: null,
    stats: {
      cpuPct: 1.5,
      memUsed: 100,
      memLimit: 1_000,
      netRx: 10,
      netTx: 20,
      blockRead: 0,
      blockWrite: 0,
    },
    ...overrides,
  };
}

export function anInventory(overrides: Partial<CoolifyInventory> = {}): CoolifyInventory {
  return {
    configured: true,
    applications: [],
    databases: [],
    servers: [],
    services: [],
    fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function aSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    collectedAt: new Date('2026-01-01T00:00:00.000Z'),
    host: aHostMetrics(),
    containers: [],
    coolify: anInventory(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Fakes (implementam os ports)                                        */
/* ------------------------------------------------------------------ */

export class FakeHostMetricsProvider extends HostMetricsPort {
  calls = 0;

  constructor(private value: HostMetrics = aHostMetrics()) {
    super();
  }

  async sample(): Promise<HostMetrics> {
    this.calls += 1;
    return this.value;
  }

  setValue(value: HostMetrics): void {
    this.value = value;
  }
}

export class FakeContainerRuntime extends ContainerRuntimePort {
  containers: ContainerInfo[] = [];
  statsValue: ContainerStats | null = {
    cpuPct: 1,
    memUsed: 100,
    memLimit: 1_000,
    netRx: 0,
    netTx: 0,
    blockRead: 0,
    blockWrite: 0,
  };
  logsValue: string | null = 'linha 1\nlinha 2';
  pingValue = true;
  statsCalls = 0;

  async list(): Promise<ContainerInfo[]> {
    return this.containers;
  }

  async stats(): Promise<ContainerStats | null> {
    this.statsCalls += 1;
    return this.statsValue;
  }

  async logs(): Promise<string | null> {
    return this.logsValue;
  }

  async ping(): Promise<boolean> {
    return this.pingValue;
  }
}

export class FakeCoolify extends CoolifyPort {
  inventoryValue: CoolifyInventory = anInventory();
  deploymentsValue: CoolifyDeployment[] = [];
  probeValue: CoolifyProbe = { url: 'http://coolify', ok: true, status: 200, error: null };

  async inventory(): Promise<CoolifyInventory> {
    return this.inventoryValue;
  }

  async deployments(): Promise<CoolifyDeployment[]> {
    return this.deploymentsValue;
  }

  async probe(): Promise<CoolifyProbe> {
    return this.probeValue;
  }
}

export class InMemorySnapshotStore extends SnapshotStorePort {
  private readonly items: MetricsSnapshot[] = [];

  push(snapshot: MetricsSnapshot): void {
    this.items.push(snapshot);
  }

  latest(): MetricsSnapshot | null {
    return this.items.at(-1) ?? null;
  }

  recent(limit: number): MetricsSnapshot[] {
    return this.items.slice(-limit);
  }
}

export class InMemoryMetricsRepository extends MetricsRepositoryPort {
  hostSamples: HostMetrics[] = [];
  containerBatches: { collectedAt: Date; containers: ContainerSnapshot[] }[] = [];
  pruned: { hostBefore: Date; containersBefore: Date } | null = null;
  seriesValue: HistoryPoint[] = [];

  async saveHost(sample: HostMetrics): Promise<void> {
    this.hostSamples.push(sample);
  }

  async saveContainers(collectedAt: Date, containers: ContainerSnapshot[]): Promise<void> {
    this.containerBatches.push({ collectedAt, containers });
  }

  async series(
    _metric: HistoryMetric,
    _rangeSeconds: number,
    _stepSeconds: number,
  ): Promise<HistoryPoint[]> {
    return this.seriesValue;
  }

  async prune(hostBefore: Date, containersBefore: Date): Promise<void> {
    this.pruned = { hostBefore, containersBefore };
  }
}

export class InMemoryConversationsRepository extends ConversationRepositoryPort {
  conversations = new Map<string, { title: string; messages: StoredMessage[] }>();
  private sequence = 0;

  async ensure(conversationId: string | undefined, firstMessage: string): Promise<string> {
    if (conversationId && this.conversations.has(conversationId)) return conversationId;

    // Como no banco: id inexistente gera uma conversa nova
    const id = `conv-${++this.sequence}`;
    this.conversations.set(id, { title: firstMessage.slice(0, 80), messages: [] });

    return id;
  }

  async history(conversationId: string): Promise<ChatTurn[]> {
    const conversation = this.conversations.get(conversationId);

    return (conversation?.messages ?? [])
      .filter((message) => message.content)
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content ?? '',
      }));
  }

  async append(conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error('conversa inexistente');

    conversation.messages.push({
      id: `msg-${conversation.messages.length + 1}`,
      role,
      content,
      createdAt: new Date().toISOString(),
    });
  }

  async list(limit: number): Promise<ConversationSummary[]> {
    return [...this.conversations.entries()].slice(0, limit).map(([id, conversation]) => ({
      id,
      title: conversation.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async detail(conversationId: string): Promise<StoredMessage[]> {
    return this.conversations.get(conversationId)?.messages ?? [];
  }

  async exists(conversationId: string): Promise<boolean> {
    return this.conversations.has(conversationId);
  }
}

export class InMemoryUserRepository extends UserRepositoryPort {
  users: (CreateUserInput & { id: string })[] = [];

  async existsByEmail(email: string): Promise<boolean> {
    return this.users.some((user) => user.email === email);
  }

  async create(input: CreateUserInput): Promise<{ id: string }> {
    const id = `user-${this.users.length + 1}`;
    this.users.push({ ...input, id });

    return { id };
  }
}

export class FakeChatAgent extends ChatAgentPort {
  configured = true;
  events: ChatEvent[] = [{ type: 'token', text: 'olá' }];
  receivedHistory: ChatTurn[] = [];

  async *stream(_message: string, history: ChatTurn[]): AsyncGenerator<ChatEvent> {
    this.receivedHistory = history;

    for (const event of this.events) {
      yield event;
    }
  }
}

export class FakeHealthProbe extends HealthProbePort {
  readonly name: string;

  constructor(
    name: string,
    private result: ProbeResult,
  ) {
    super();
    this.name = name;
  }

  async probe(): Promise<ProbeResult> {
    return this.result;
  }
}

export class FakeAppSettings extends AppSettingsPort {
  get(): AppSettings {
    return {
      hostProcPath: '/host/proc',
      hostSysPath: '/host/sys',
      hostRootPath: '/host/root',
      dockerProxyUrl: 'http://docker-socket-proxy:2375',
      metricsIntervalMs: 15_000,
      retentionDays: 30,
      llmProvider: 'groq',
      llmModel: 'openai/gpt-oss-20b',
    };
  }
}
