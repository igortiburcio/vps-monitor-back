export interface CoolifyApplication {
  uuid: string;
  name: string;
  description: string | null;
  fqdn: string | null;
  status: string;
  buildPack: string | null;
  gitBranch: string | null;
}

export interface CoolifyDatabase {
  uuid: string;
  name: string;
  type: string;
  status: string;
  isPublic: boolean;
  image: string | null;
}

export interface CoolifyServiceItem {
  uuid: string;
  name: string;
  type: string;
  status: string;
}

export interface CoolifyServer {
  uuid: string;
  name: string;
  isReachable: boolean;
  isUsable: boolean;
  isCoolifyHost: boolean;
}

export interface CoolifyDeployment {
  uuid: string | null;
  applicationName: string | null;
  status: string | null;
  commit: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

export interface CoolifyInventory {
  configured: boolean;
  applications: CoolifyApplication[];
  databases: CoolifyDatabase[];
  servers: CoolifyServer[];
  services: CoolifyServiceItem[];
  fetchedAt: Date | null;
}

export interface CoolifyProbe {
  url: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
}
