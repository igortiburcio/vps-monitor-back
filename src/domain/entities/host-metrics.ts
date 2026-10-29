/**
 * Métricas do host. Tipo puro: nenhuma dependência de tecnologia.
 * Valores nulos indicam métrica indisponível (ex.: /proc não montado).
 */
export interface HostMetrics {
  ts: Date;
  available: boolean;
  cpuPct: number | null;
  cpuPerCore: number[] | null;
  memUsed: number | null;
  memTotal: number | null;
  swapUsed: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  uptimeSec: number | null;
  tempC: number | null;
}

/** Percentual seguro (0–100), com 1 casa decimal. */
export function percentage(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null;

  const value = (used / total) * 100;

  return Number(Math.min(100, Math.max(0, value)).toFixed(1));
}
