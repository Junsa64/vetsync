/** Única puerta de entrada al módulo de veterinarios para otros módulos. */
import type { VetRepository } from './application/ports.js';

export interface VetsPublicApi {
  vetExists(vetId: string): Promise<boolean>;
  getVetName(vetId: string): Promise<string | null>;
}

export function createVetsPublicApi(deps: { vets: VetRepository }): VetsPublicApi {
  return {
    async vetExists(vetId: string): Promise<boolean> {
      return (await deps.vets.findById(vetId)) !== null;
    },
    async getVetName(vetId: string): Promise<string | null> {
      return (await deps.vets.findById(vetId))?.fullName ?? null;
    },
  };
}
