import type {
  CoolifyApplication,
  CoolifyDatabase,
  CoolifyServer,
  CoolifyServiceItem,
} from '../../domain/entities/coolify.js';

export interface OverviewHost {
  available: boolean;
  cpuPct: number | null;
  cpuPerCore: number[] | null;
  memUsed: number | null;
  memTotal: number | null;
  memPct: number | null;
  swapUsed: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  diskPct: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  uptimeSec: number | null;
  tempC: number | null;
}

export interface OverviewContainer {
  id: string;
  name: string;
  /** nome legível: o container do Coolify é nomeado pelo UUID do recurso */
  displayName: string;
  image: string;
  state: string;
  status: string;
  health: string | null;
  coolifyUuid: string | null;
  cpuPct: number | null;
  memUsed: number | null;
  memLimit: number | null;
  memPct: number | null;
  netRx: number | null;
  netTx: number | null;
}

export interface Overview {
  collectedAt: string;
  host: OverviewHost;
  containers: OverviewContainer[];
  coolify: {
    configured: boolean;
    applications: CoolifyApplication[];
    databases: CoolifyDatabase[];
    servers: CoolifyServer[];
    services: CoolifyServiceItem[];
  };
}
