import type { ContainerInfo, ContainerStats } from '../entities/container.js';

/** Porta de saída: runtime de containers (Docker, Podman, …). */
export abstract class ContainerRuntimePort {
  abstract list(): Promise<ContainerInfo[]>;
  abstract stats(containerId: string): Promise<ContainerStats | null>;
  abstract logs(containerId: string, lines: number): Promise<string | null>;
  /** Usado pelo diagnóstico: o runtime está acessível? */
  abstract ping(): Promise<boolean>;
}
