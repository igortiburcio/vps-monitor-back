export const HISTORY_METRICS = ['cpu', 'memory', 'load', 'net_rx', 'net_tx', 'disk'] as const;

export type HistoryMetric = (typeof HISTORY_METRICS)[number];
