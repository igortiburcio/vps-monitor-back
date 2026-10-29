import { describe, expect, it } from 'bun:test';

import {
  cpuUsagePercent,
  parseDiskstats,
  parseLoadavg,
  parseMeminfo,
  parseNetDev,
  parseProcStat,
  parseTemperature,
  parseUptime,
} from '../src/collectors/host/proc.js';

const PROC_STAT = `cpu  12345 678 9012 345678 456 789 123 45 0 0
cpu0 6172 339 4506 172839 228 394 61 22 0 0
cpu1 6173 339 4506 172839 228 395 62 23 0 0
intr 1234567 1 2 3
ctxt 9876543
btime 1700000000
processes 12345
procs_running 2
procs_blocked 0
`;

const MEMINFO = `MemTotal:       16384000 kB
MemFree:         1234567 kB
MemAvailable:    9876543 kB
Buffers:          123456 kB
Cached:          4567890 kB
SwapCached:            0 kB
SwapTotal:       2097152 kB
SwapFree:        2097152 kB
`;

const NET_DEV = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0
  eth0: 5000000 4000 0 0 0 0 0 0 3000000 3500 0 0 0 0 0 0
  eth1: 2000000 1000 0 0 0 0 0 0 1000000 900 0 0 0 0 0 0
`;

const DISKSTATS = `   8       0 sda 12345 100 500000 2000 54321 200 400000 3000 0 4000 5000
   8       1 sda1 12000 90 490000 1900 54000 190 390000 2900 0 3900 4800
 259       0 nvme0n1 1000 10 20000 100 2000 20 30000 200 0 250 300
 259       1 nvme0n1p1 900 9 19000 90 1900 19 29000 190 0 240 290
   7       0 loop0 5 0 100 0 5 0 100 0 0 10 10
`;

describe('parseProcStat', () => {
  it('lê a linha agregada e as linhas por core', () => {
    const snapshot = parseProcStat(PROC_STAT);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.perCore).toHaveLength(2);
    expect(snapshot?.aggregate.total).toBe(12345 + 678 + 9012 + 345678 + 456 + 789 + 123 + 45);
    expect(snapshot?.aggregate.idle).toBe(345678 + 456);
  });

  it('retorna null sem linha de cpu', () => {
    expect(parseProcStat('intr 1\n')).toBeNull();
  });
});

describe('cpuUsagePercent', () => {
  it('calcula 30% com 70% de ociosidade no delta', () => {
    const usage = cpuUsagePercent({ total: 1000, idle: 500 }, { total: 2000, idle: 1200 });

    expect(usage).toBe(30);
  });

  it('não divide por zero', () => {
    expect(cpuUsagePercent({ total: 1000, idle: 500 }, { total: 1000, idle: 500 })).toBe(0);
  });

  it('nunca passa de 100 nem fica negativo', () => {
    expect(cpuUsagePercent({ total: 0, idle: 0 }, { total: 100, idle: 0 })).toBe(100);
  });
});

describe('parseMeminfo', () => {
  it('converte kB para bytes e usa MemAvailable', () => {
    const memory = parseMeminfo(MEMINFO);

    expect(memory?.total).toBe(16_384_000 * 1024);
    expect(memory?.available).toBe(9_876_543 * 1024);
    expect(memory?.used).toBe((16_384_000 - 9_876_543) * 1024);
    expect(memory?.swapTotal).toBe(2_097_152 * 1024);
    expect(memory?.swapUsed).toBe(0);
  });

  it('retorna null sem MemTotal', () => {
    expect(parseMeminfo('MemFree: 1 kB\n')).toBeNull();
  });
});

describe('parseLoadavg', () => {
  it('lê as três médias e a contagem de processos', () => {
    expect(parseLoadavg('0.52 0.41 0.38 2/345 6789')).toEqual({
      load1: 0.52,
      load5: 0.41,
      load15: 0.38,
      running: 2,
      total: 345,
    });
  });

  it('retorna null em conteúdo inválido', () => {
    expect(parseLoadavg('lixo')).toBeNull();
  });
});

describe('parseUptime', () => {
  it('usa a primeira coluna em segundos', () => {
    expect(parseUptime('123456.78 987654.32')).toBe(123_456);
  });
});

describe('parseNetDev', () => {
  it('soma as interfaces e ignora loopback', () => {
    expect(parseNetDev(NET_DEV)).toEqual({
      rxBytes: 5_000_000 + 2_000_000,
      txBytes: 3_000_000 + 1_000_000,
    });
  });
});

describe('parseDiskstats', () => {
  it('conta só discos inteiros, sem partições nem loop', () => {
    const counters = parseDiskstats(DISKSTATS);

    // sda (500000 leitura / 400000 escrita) + nvme0n1 (20000 / 30000)
    expect(counters.readBytes).toBe((500_000 + 20_000) * 512);
    expect(counters.writeBytes).toBe((400_000 + 30_000) * 512);
  });
});

describe('parseTemperature', () => {
  it('converte mili-graus para celsius', () => {
    expect(parseTemperature('45000')).toBe(45);
  });

  it('retorna null para conteúdo inválido', () => {
    expect(parseTemperature('abc')).toBeNull();
  });
});
