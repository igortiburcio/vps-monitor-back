import type { ProbeResult } from '../ports/health-probe.port.js';

/**
 * Resultado do health check.
 * Mantém o formato que a API já expunha (compatível com Terminus),
 * para não quebrar consumidores existentes.
 */
export interface HealthReport {
  status: 'ok' | 'error';
  info: Record<string, ProbeResult>;
  error: Record<string, ProbeResult>;
  details: Record<string, ProbeResult>;
}
