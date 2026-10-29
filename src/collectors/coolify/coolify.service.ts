import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env.js';

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

export interface CoolifyServer {
  uuid: string;
  name: string;
  isReachable: boolean;
  isUsable: boolean;
  isCoolifyHost: boolean;
}

export interface CoolifyServiceItem {
  uuid: string;
  name: string;
  type: string;
  status: string;
}

export interface CoolifyInventory {
  configured: boolean;
  applications: CoolifyApplication[];
  databases: CoolifyDatabase[];
  servers: CoolifyServer[];
  services: CoolifyServiceItem[];
  fetchedAt: Date | null;
}

export interface CoolifyDeployment {
  uuid: string | null;
  applicationName: string | null;
  status: string | null;
  commit: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

const CACHE_TTL_MS = 30_000;

interface RawApplication {
  uuid: string;
  name: string;
  description?: string | null;
  fqdn?: string | null;
  status?: string;
  build_pack?: string | null;
  git_branch?: string | null;
}

interface RawDatabase {
  uuid: string;
  name: string;
  database_type?: string;
  status?: string;
  is_public?: boolean;
  image?: string | null;
}

interface RawServer {
  uuid: string;
  name: string;
  is_reachable?: boolean;
  is_usable?: boolean;
  is_coolify_host?: boolean;
}

interface RawService {
  uuid: string;
  name: string;
  service_type?: string;
  type?: string;
  status?: string;
}

interface RawDeployment {
  uuid?: string;
  deployment_uuid?: string;
  application_name?: string;
  status?: string;
  commit?: string;
  created_at?: string;
  finished_at?: string;
}

/**
 * Cliente da API do Coolify com cache curto.
 * Os payloads originais são enormes (dockerfile, compose, labels em base64),
 * então projetamos DTOs enxutos — que é o que a UI e o LLM consomem.
 */
@Injectable()
export class CoolifyService {
  private readonly logger = new Logger(CoolifyService.name);
  private cache: { at: number; data: CoolifyInventory } | null = null;
  private inflight: Promise<CoolifyInventory> | null = null;
  private warned = false;

  get configured(): boolean {
    return Boolean(env.COOLIFY_URL && env.COOLIFY_TOKEN);
  }

  async inventory(): Promise<CoolifyInventory> {
    if (!this.configured) {
      return {
        configured: false,
        applications: [],
        databases: [],
        servers: [],
        services: [],
        fetchedAt: null,
      };
    }

    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.data;
    }

    if (this.inflight) return this.inflight;

    this.inflight = this.load().finally(() => {
      this.inflight = null;
    });

    return this.inflight;
  }

  private deploymentsCache: { at: number; data: CoolifyDeployment[] } | null = null;

  /**
   * Histórico de deploys. O endpoint pode vir vazio em instalações
   * que nunca registraram deployment pela API.
   */
  async deployments(): Promise<CoolifyDeployment[]> {
    if (!this.configured) return [];

    if (this.deploymentsCache && Date.now() - this.deploymentsCache.at < CACHE_TTL_MS) {
      return this.deploymentsCache.data;
    }

    const raw = await this.fetch<RawDeployment[]>('/deployments');

    const data: CoolifyDeployment[] = (raw ?? []).map((deployment) => ({
      uuid: deployment.uuid ?? deployment.deployment_uuid ?? null,
      applicationName: deployment.application_name ?? null,
      status: deployment.status ?? null,
      commit: deployment.commit ?? null,
      createdAt: deployment.created_at ?? null,
      finishedAt: deployment.finished_at ?? null,
    }));

    this.deploymentsCache = { at: Date.now(), data };

    return data;
  }

  private async load(): Promise<CoolifyInventory> {
    const [applications, databases, servers, services] = await Promise.all([
      this.fetch<RawApplication[]>('/applications'),
      this.fetch<RawDatabase[]>('/databases'),
      this.fetch<RawServer[]>('/servers'),
      this.fetch<RawService[]>('/services'),
    ]);

    const data: CoolifyInventory = {
      configured: true,
      applications: (applications ?? []).map((app) => ({
        uuid: app.uuid,
        name: app.name,
        description: app.description ?? null,
        fqdn: app.fqdn ?? null,
        status: app.status ?? 'unknown',
        buildPack: app.build_pack ?? null,
        gitBranch: app.git_branch ?? null,
      })),
      databases: (databases ?? []).map((database) => ({
        uuid: database.uuid,
        name: database.name,
        type: database.database_type ?? 'unknown',
        status: database.status ?? 'unknown',
        isPublic: database.is_public ?? false,
        image: database.image ?? null,
      })),
      servers: (servers ?? []).map((server) => ({
        uuid: server.uuid,
        name: server.name,
        isReachable: server.is_reachable ?? false,
        isUsable: server.is_usable ?? false,
        isCoolifyHost: server.is_coolify_host ?? false,
      })),
      services: (services ?? []).map((service) => ({
        uuid: service.uuid,
        name: service.name,
        type: service.service_type ?? service.type ?? 'service',
        status: service.status ?? 'unknown',
      })),
      fetchedAt: new Date(),
    };

    this.cache = { at: Date.now(), data };

    return data;
  }

  private async fetch<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${env.COOLIFY_URL}/api/v1${path}`, {
        headers: {
          Authorization: `Bearer ${env.COOLIFY_TOKEN}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.warnOnce(`Coolify respondeu ${response.status} em ${path}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.warnOnce(
        `Coolify inacessível: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      return null;
    }
  }

  private warnOnce(message: string): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn(`${message} — seção do Coolify ficará vazia`);
  }
}
