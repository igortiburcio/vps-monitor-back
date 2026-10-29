import { Injectable, Logger } from '@nestjs/common';

import type {
  CoolifyApplication,
  CoolifyDatabase,
  CoolifyDeployment,
  CoolifyInventory,
  CoolifyProbe,
  CoolifyServer,
  CoolifyServiceItem,
} from '../../domain/entities/coolify.js';
import { CoolifyPort } from '../../domain/ports/coolify.port.js';
import { env } from '../config/env.js';

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
export class CoolifyHttpAdapter extends CoolifyPort {
  private readonly logger = new Logger(CoolifyHttpAdapter.name);
  private cache: { at: number; data: CoolifyInventory } | null = null;
  private inflight: Promise<CoolifyInventory> | null = null;
  private deploymentsCache: { at: number; data: CoolifyDeployment[] } | null = null;
  private lastWarnAt = 0;

  get configured(): boolean {
    return Boolean(env.COOLIFY_API_URL && env.COOLIFY_API_TOKEN);
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

  /** Diagnóstico: URL usada, status e corpo do erro (nunca expõe o token). */
  async probe(): Promise<CoolifyProbe> {
    if (!this.configured) {
      return {
        url: env.COOLIFY_API_URL ?? null,
        ok: false,
        status: null,
        error: 'não configurado',
      };
    }

    try {
      const response = await fetch(`${env.COOLIFY_API_URL}/api/v1/applications`, {
        headers: {
          Authorization: `Bearer ${env.COOLIFY_API_TOKEN}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      const body = await response.text();

      return {
        url: env.COOLIFY_API_URL ?? null,
        ok: response.ok,
        status: response.status,
        error: response.ok ? null : body.slice(0, 300),
      };
    } catch (error) {
      return {
        url: env.COOLIFY_API_URL ?? null,
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      };
    }
  }

  private async load(): Promise<CoolifyInventory> {
    const [applications, databases, servers, services] = await Promise.all([
      this.fetch<RawApplication[]>('/applications'),
      this.fetch<RawDatabase[]>('/databases'),
      this.fetch<RawServer[]>('/servers'),
      this.fetch<RawService[]>('/services'),
    ]);

    // Se todas as chamadas falharam, não cacheia: a próxima requisição tenta de novo.
    const allFailed = [applications, databases, servers, services].every(
      (result) => result === null,
    );

    const data: CoolifyInventory = {
      configured: true,
      applications: (applications ?? []).map<CoolifyApplication>((app) => ({
        uuid: app.uuid,
        name: app.name,
        description: app.description ?? null,
        fqdn: app.fqdn ?? null,
        status: app.status ?? 'unknown',
        buildPack: app.build_pack ?? null,
        gitBranch: app.git_branch ?? null,
      })),
      databases: (databases ?? []).map<CoolifyDatabase>((database) => ({
        uuid: database.uuid,
        name: database.name,
        type: database.database_type ?? 'unknown',
        status: database.status ?? 'unknown',
        isPublic: database.is_public ?? false,
        image: database.image ?? null,
      })),
      servers: (servers ?? []).map<CoolifyServer>((server) => ({
        uuid: server.uuid,
        name: server.name,
        isReachable: server.is_reachable ?? false,
        isUsable: server.is_usable ?? false,
        isCoolifyHost: server.is_coolify_host ?? false,
      })),
      services: (services ?? []).map<CoolifyServiceItem>((service) => ({
        uuid: service.uuid,
        name: service.name,
        type: service.service_type ?? service.type ?? 'service',
        status: service.status ?? 'unknown',
      })),
      fetchedAt: new Date(),
    };

    if (!allFailed) {
      this.cache = { at: Date.now(), data };
    }

    return data;
  }

  private async fetch<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${env.COOLIFY_API_URL}/api/v1${path}`, {
        headers: {
          Authorization: `Bearer ${env.COOLIFY_API_TOKEN}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.warn(`Coolify respondeu ${response.status} em ${path}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.warn(
        `Coolify inacessível: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );

      return null;
    }
  }

  private warn(message: string): void {
    const now = Date.now();
    // evita spam, mas continua visível se a falha persistir
    if (now - this.lastWarnAt < 5 * 60_000) return;

    this.lastWarnAt = now;
    this.logger.warn(`${message} — seção do Coolify pode ficar vazia`);
  }
}
