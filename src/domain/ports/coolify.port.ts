import type { CoolifyDeployment, CoolifyInventory, CoolifyProbe } from '../entities/coolify.js';

/** Porta de saída: provedor de deploy (Coolify hoje). */
export abstract class CoolifyPort {
  abstract inventory(): Promise<CoolifyInventory>;
  abstract deployments(): Promise<CoolifyDeployment[]>;
  abstract probe(): Promise<CoolifyProbe>;
}
