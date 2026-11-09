import type { MedicalRecord, Owner, Pet } from '../domain/patients.js';

export interface OwnerRepository {
  save(owner: Owner): Promise<void>;
  findById(id: string): Promise<Owner | null>;
  findByEmail(email: string): Promise<Owner | null>;
  list(): Promise<Owner[]>;
}

export interface PetFilter {
  ownerId?: string;
}

export interface PetRepository {
  save(pet: Pet): Promise<void>;
  findById(id: string): Promise<Pet | null>;
  list(filter: PetFilter): Promise<Pet[]>;
}

export interface MedicalRecordRepository {
  add(record: MedicalRecord): Promise<void>;
  /** Historial ordenado del registro más reciente al más antiguo. */
  listByPet(petId: string): Promise<MedicalRecord[]>;
}
