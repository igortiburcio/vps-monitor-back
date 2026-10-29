import type { HistoryMetric } from './history-metric.js';

export interface HistoryPoint {
  ts: string;
  value: number | null;
}

export interface HistorySeries {
  metric: HistoryMetric;
  rangeSeconds: number;
  stepSeconds: number;
  points: HistoryPoint[];
}
