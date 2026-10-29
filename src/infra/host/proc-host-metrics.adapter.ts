import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type { HostMetrics } from '../../domain/entities/host-metrics.js';
import { HostMetricsPort } from '../../domain/ports/host-metrics.port.js';
import { env } from '../config/env.js';
import {
  type CpuSnapshot,
  cpuUsagePercent,
  type NetCounters,
  parseDiskstats,
  parseLoadavg,
  parseMeminfo,
  parseNetDev,
  parseProcStat,
  parseTemperature,
  parseUptime,
} from './proc.parser.js';

/**
 * Adapter de métricas do host lendo /proc e /sys.
 * Em dev (macOS) os caminhos não existem: devolve `available: false`
 * em vez de quebrar a API.
 */
@Injectable()
export class ProcHostMetricsAdapter extends HostMetricsPort {
  private readonly logger = new Logger(ProcHostMetricsAdapter.name);
  private previousCpu: CpuSnapshot | null = null;
  private previousNet: NetCounters | null = null;
  private previousNetAt: number | null = null;
  private warned = false;

  sample(): Promise<HostMetrics> {
    return Promise.resolve(this.buildSample());
  }

  private buildSample(): HostMetrics {
    const stat = this.read('stat');
    const meminfo = this.read('meminfo');

    if (!stat || !meminfo) {
      if (!this.warned) {
        this.logger.warn(`/proc indisponível em "${env.HOST_PROC}" — métricas de host desativadas`);
        this.warned = true;
      }

      return this.emptySample();
    }

    const cpu = parseProcStat(stat);
    const memory = parseMeminfo(meminfo);
    const load = parseLoadavg(this.read('loadavg') ?? '');
    const net = parseNetDev(this.read('net/dev') ?? '');
    const uptimeSec = parseUptime(this.read('uptime') ?? '');
    const tempC = this.readTemperature();

    const now = Date.now();

    const cpuPct =
      cpu && this.previousCpu ? cpuUsagePercent(this.previousCpu.aggregate, cpu.aggregate) : null;

    const cpuPerCore =
      cpu && this.previousCpu && this.previousCpu.perCore.length === cpu.perCore.length
        ? cpu.perCore.map((core, index) => {
            const previousCore = this.previousCpu?.perCore[index];
            return previousCore ? cpuUsagePercent(previousCore, core) : 0;
          })
        : null;

    let netRxBps: number | null = null;
    let netTxBps: number | null = null;

    if (this.previousNet && this.previousNetAt) {
      const elapsedSeconds = (now - this.previousNetAt) / 1000;
      if (elapsedSeconds > 0) {
        netRxBps = Math.max(
          0,
          Math.round((net.rxBytes - this.previousNet.rxBytes) / elapsedSeconds),
        );
        netTxBps = Math.max(
          0,
          Math.round((net.txBytes - this.previousNet.txBytes) / elapsedSeconds),
        );
      }
    }

    this.previousCpu = cpu;
    this.previousNet = net;
    this.previousNetAt = now;

    const diskUsage = this.diskUsage();

    return {
      ts: new Date(now),
      available: true,
      cpuPct,
      cpuPerCore,
      memUsed: memory?.used ?? null,
      memTotal: memory?.total ?? null,
      swapUsed: memory?.swapUsed ?? null,
      load1: load?.load1 ?? null,
      load5: load?.load5 ?? null,
      load15: load?.load15 ?? null,
      diskUsed: diskUsage?.used ?? null,
      diskTotal: diskUsage?.total ?? null,
      netRxBps,
      netTxBps,
      uptimeSec,
      tempC,
    };
  }

  /** I/O acumulado desde o boot, em bytes. */
  diskIo(): { readBytes: number; writeBytes: number } {
    const content = this.read('diskstats');

    return content ? parseDiskstats(content) : { readBytes: 0, writeBytes: 0 };
  }

  private diskUsage(): { used: number; total: number } | null {
    try {
      const stats = statfsSync(env.HOST_ROOT);
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;

      return { used: total - free, total };
    } catch {
      return null;
    }
  }

  private readTemperature(): number | null {
    const path = join(env.HOST_SYS, 'class/thermal/thermal_zone0/temp');
    if (!existsSync(path)) return null;

    try {
      return parseTemperature(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  }

  private read(relativePath: string): string | null {
    const path = join(env.HOST_PROC, relativePath);

    try {
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    } catch {
      return null;
    }
  }

  private emptySample(): HostMetrics {
    return {
      ts: new Date(),
      available: false,
      cpuPct: null,
      cpuPerCore: null,
      memUsed: null,
      memTotal: null,
      swapUsed: null,
      load1: null,
      load5: null,
      load15: null,
      diskUsed: null,
      diskTotal: null,
      netRxBps: null,
      netTxBps: null,
      uptimeSec: null,
      tempC: null,
    };
  }
}
