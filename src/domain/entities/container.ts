export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  health: string | null;
  /** UUID do recurso correspondente no Coolify, quando identificável */
  coolifyUuid: string | null;
}

export interface ContainerStats {
  cpuPct: number;
  memUsed: number;
  memLimit: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
}

export interface ContainerSnapshot extends ContainerInfo {
  stats: ContainerStats | null;
}
