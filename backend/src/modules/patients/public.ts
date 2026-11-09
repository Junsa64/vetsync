/**
 * Única puerta de entrada al módulo de pacientes para otros módulos.
 * Expone lo mínimo: existencia de la mascota y el contacto del dueño.
 */
import type { OwnerRepository, PetRepository } from './application/ports.js';

export interface PetContact {
  ownerName: string;
  ownerEmail: string;
  petName: string;
}

export interface PatientsPublicApi {
  petExists(petId: string): Promise<boolean>;
  getContactForPet(petId: string): Promise<PetContact | null>;
}

export function createPatientsPublicApi(deps: { owners: OwnerRepository; pets: PetRepository }): PatientsPublicApi {
  return {
    async petExists(petId: string): Promise<boolean> {
      return (await deps.pets.findById(petId)) !== null;
    },
    async getContactForPet(petId: string): Promise<PetContact | null> {
      const pet = await deps.pets.findById(petId);
      if (!pet) {
        return null;
      }
      const owner = await deps.owners.findById(pet.ownerId);
      if (!owner) {
        return null;
      }
      return { ownerName: owner.fullName, ownerEmail: owner.email, petName: pet.name };
    },
  };
}
