import { Injectable, Logger } from '@nestjs/common';

import type { ContainerInfo, ContainerStats } from '../../domain/entities/container.js';
import { ContainerRuntimePort } from '../../domain/ports/container-runtime.port.js';
import { env } from '../config/env.js';

interface DockerContainerRaw {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Labels: Record<string, string> | null;
}

interface DockerStatsRaw {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: {
    usage?: number;
    limit?: number;
    stats?: { cache?: number };
  };
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
  blkio_stats?: {
    io_service_bytes_recursive?: { op?: string; value?: number }[] | null;
  } | null;
}

/** Containers do Coolify: `{uuid}`, `{uuid}-{timestamp}` ou `{uuid}-proxy`. */
const COOLIFY_NAME_PREFIX = /^([a-z0-9]{20,})(?:-|$)/;

@Injectable()
export class DockerHttpAdapter extends ContainerRuntimePort {
  private readonly logger = new Logger(DockerHttpAdapter.name);
  private warned = false;

  async list(): Promise<ContainerInfo[]> {
    const raw = await this.request<DockerContainerRaw[]>('/containers/json?all=1');
    if (!raw) return [];

    return raw.map((container) => ({
      id: container.Id,
      name: (container.Names[0] ?? '').replace(/^\//, ''),
      image: container.Image,
      state: container.State,
      status: container.Status,
      health: this.parseHealth(container.Status),
      coolifyUuid: this.resolveCoolifyUuid(container),
    }));
  }

  async stats(containerId: string): Promise<ContainerStats | null> {
    const raw = await this.request<DockerStatsRaw>(
      `/containers/${containerId}/stats?stream=false&one-shot=true`,
    );

    if (!raw) return null;

    const cpuDelta =
      (raw.cpu_stats?.cpu_usage?.total_usage ?? 0) -
      (raw.precpu_stats?.cpu_usage?.total_usage ?? 0);
    const systemDelta =
      (raw.cpu_stats?.system_cpu_usage ?? 0) - (raw.precpu_stats?.system_cpu_usage ?? 0);
    const onlineCpus = raw.cpu_stats?.online_cpus ?? 1;

    const cpuPct =
      systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

    const cache = raw.memory_stats?.stats?.cache ?? 0;
    const memUsed = Math.max(0, (raw.memory_stats?.usage ?? 0) - cache);

    let netRx = 0;
    let netTx = 0;
    for (const network of Object.values(raw.networks ?? {})) {
      netRx += network.rx_bytes ?? 0;
      netTx += network.tx_bytes ?? 0;
    }

    let blockRead = 0;
    let blockWrite = 0;
    for (const entry of raw.blkio_stats?.io_service_bytes_recursive ?? []) {
      if (entry.op === 'Read') blockRead += entry.value ?? 0;
      if (entry.op === 'Write') blockWrite += entry.value ?? 0;
    }

    return {
      cpuPct: Number(cpuPct.toFixed(2)),
      memUsed,
      memLimit: raw.memory_stats?.limit ?? 0,
      netRx,
      netTx,
      blockRead,
      blockWrite,
    };
  }

  async logs(containerId: string, lines: number): Promise<string | null> {
    try {
      const response = await fetch(
        `${env.DOCKER_PROXY_URL}/containers/${containerId}/logs?stdout=1&stderr=1&tail=${lines}&timestamps=1`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());

      return this.stripDockerFrames(buffer);
    } catch {
      return null;
    }
  }

  async ping(): Promise<boolean> {
    const response = await this.request<unknown>('/version');

    return response !== null;
  }

  private parseHealth(status: string): string | null {
    if (/\(healthy\)/.test(status)) return 'healthy';
    if (/\(unhealthy\)/.test(status)) return 'unhealthy';
    if (/\(health: starting\)/.test(status)) return 'starting';

    return null;
  }

  /** Docker multiplexa o stream com um cabeçalho de 8 bytes por frame. */
  private stripDockerFrames(buffer: Buffer): string {
    const chunks: string[] = [];
    let offset = 0;

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset + 4);
      const start = offset + 8;
      const end = start + length;

      if (end > buffer.length) {
        chunks.push(buffer.subarray(start).toString('utf8'));
        break;
      }

      chunks.push(buffer.subarray(start, end).toString('utf8'));
      offset = end;
    }

    return chunks.length > 0 ? chunks.join('') : buffer.toString('utf8');
  }

  private resolveCoolifyUuid(container: DockerContainerRaw): string | null {
    const labels = container.Labels ?? {};
    const fromLabel =
      labels['coolify.applicationId'] ??
      labels['coolify.serviceId'] ??
      labels['coolify.databaseId'];

    if (fromLabel) return fromLabel;

    const name = (container.Names[0] ?? '').replace(/^\//, '');

    return COOLIFY_NAME_PREFIX.exec(name)?.[1] ?? null;
  }

  private async request<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${env.DOCKER_PROXY_URL}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.warnOnce(`Docker respondeu ${response.status} em ${path}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.warnOnce(
        `Docker inacessível em ${env.DOCKER_PROXY_URL}: ${
          error instanceof Error ? error.message : 'erro'
        }`,
      );

      return null;
    }
  }

  private warnOnce(message: string): void {
    if (this.warned) return;

    this.warned = true;
    this.logger.warn(`${message} — métricas de container desativadas`);
  }
}
