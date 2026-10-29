/**
 * Parsers puros dos arquivos de /proc e /sys.
 * Sem I/O aqui: recebem o conteúdo como string para poderem ser testados
 * com fixtures reais de uma VPS Linux.
 */

export interface CpuTimes {
  /** soma de todas as colunas (jiffies) */
  total: number;
  /** idle + iowait */
  idle: number;
}

export interface CpuSnapshot {
  aggregate: CpuTimes;
  perCore: CpuTimes[];
}

export interface MemoryInfo {
  total: number;
  available: number;
  used: number;
  swapTotal: number;
  swapUsed: number;
}

export interface LoadAverage {
  load1: number;
  load5: number;
  load15: number;
  running: number;
  total: number;
}

export interface NetCounters {
  rxBytes: number;
  txBytes: number;
}

export interface DiskCounters {
  readBytes: number;
  writeBytes: number;
}

const SECTOR_SIZE = 512;

/** Dispositivos virtuais que distorcem o I/O total. */
const VIRTUAL_DEVICE = /^(loop|ram|dm-|sr|zram)/;

/** Partições: contam em dobro se somadas ao disco inteiro. */
const PARTITION_DEVICE = [
  /^sd[a-z]+\d+$/,
  /^vd[a-z]+\d+$/,
  /^hd[a-z]+\d+$/,
  /^nvme\d+n\d+p\d+$/,
  /^mmcblk\d+p\d+$/,
];

function isWholeDevice(name: string): boolean {
  if (VIRTUAL_DEVICE.test(name)) return false;
  return !PARTITION_DEVICE.some((pattern) => pattern.test(name));
}

function toNumbers(value: string): number[] {
  return value.trim().split(/\s+/).map(Number);
}

function parseCpuLine(line: string | undefined): CpuTimes | null {
  if (!line) return null;

  // cpu user nice system idle iowait irq softirq steal [guest guest_nice]
  // guest/guest_nice já estão contidos em user/nice, por isso são ignorados.
  const fields = toNumbers(line).slice(1, 9);

  if (fields.length < 4 || fields.some((n) => Number.isNaN(n))) return null;

  const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] =
    fields;

  return {
    total: user + nice + system + idle + iowait + irq + softirq + steal,
    idle: idle + iowait,
  };
}

export function parseProcStat(content: string): CpuSnapshot | null {
  const lines = content.split('\n');

  const aggregate = parseCpuLine(lines.find((line) => /^cpu\s/.test(line)));
  if (!aggregate) return null;

  const perCore = lines
    .filter((line) => /^cpu\d+\s/.test(line))
    .map((line) => parseCpuLine(line))
    .filter((cpu): cpu is CpuTimes => cpu !== null);

  return { aggregate, perCore };
}

/** Uso de CPU (%) entre duas leituras. */
export function cpuUsagePercent(previous: CpuTimes, current: CpuTimes): number {
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;

  if (totalDelta <= 0) return 0;

  const usage = (1 - idleDelta / totalDelta) * 100;

  return Math.min(100, Math.max(0, Number(usage.toFixed(2))));
}

export function parseMeminfo(content: string): MemoryInfo | null {
  const values = new Map<string, number>();

  for (const line of content.split('\n')) {
    const match = /^(\w+):\s+(\d+)/.exec(line);
    if (match?.[1] && match[2]) {
      values.set(match[1], Number(match[2]) * 1024);
    }
  }

  const total = values.get('MemTotal');
  if (!total) return null;

  const available = values.get('MemAvailable') ?? values.get('MemFree') ?? 0;
  const swapTotal = values.get('SwapTotal') ?? 0;
  const swapFree = values.get('SwapFree') ?? 0;

  return {
    total,
    available,
    // MemAvailable é mais fiel que MemFree (inclui cache reaproveitável)
    used: Math.max(0, total - available),
    swapTotal,
    swapUsed: Math.max(0, swapTotal - swapFree),
  };
}

export function parseLoadavg(content: string): LoadAverage | null {
  const match = /^([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\/(\d+)/.exec(content.trim());
  if (!match) return null;

  return {
    load1: Number(match[1]),
    load5: Number(match[2]),
    load15: Number(match[3]),
    running: Number(match[4]),
    total: Number(match[5]),
  };
}

export function parseUptime(content: string): number | null {
  const seconds = Number.parseFloat(content.trim().split(/\s+/)[0] ?? '');
  return Number.isFinite(seconds) ? Math.floor(seconds) : null;
}

export function parseNetDev(content: string): NetCounters {
  const counters: NetCounters = { rxBytes: 0, txBytes: 0 };

  for (const line of content.split('\n')) {
    const match = /^\s*([\w@.-]+):\s*(.+)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;

    const iface = match[1];
    if (iface === 'lo') continue;

    const fields = toNumbers(match[2]);
    const rx = fields[0];
    const tx = fields[8];
    if (rx === undefined || tx === undefined) continue;

    counters.rxBytes += rx;
    counters.txBytes += tx;
  }

  return counters;
}

export function parseDiskstats(content: string): DiskCounters {
  const counters: DiskCounters = { readBytes: 0, writeBytes: 0 };

  for (const line of content.split('\n')) {
    const fields = toNumbers(line);
    // major minor name reads reads_merged sectors_read ms writes writes_merged sectors_written ...
    const name = line.trim().split(/\s+/)[2];
    if (!name || fields.length < 10) continue;
    if (!isWholeDevice(name)) continue;

    const sectorsRead = fields[5];
    const sectorsWritten = fields[9];
    if (sectorsRead === undefined || sectorsWritten === undefined) continue;

    counters.readBytes += sectorsRead * SECTOR_SIZE;
    counters.writeBytes += sectorsWritten * SECTOR_SIZE;
  }

  return counters;
}

/** /sys/class/thermal/thermal_zone0/temp vem em mili-graus. */
export function parseTemperature(content: string): number | null {
  const milliCelsius = Number.parseInt(content.trim(), 10);
  if (!Number.isFinite(milliCelsius)) return null;

  return Number((milliCelsius / 1000).toFixed(1));
}
