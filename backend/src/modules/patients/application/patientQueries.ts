import { NotFoundError } from '../../../shared/errors.js';
import type { MedicalRecord, Owner, Pet } from '../domain/patients.js';
import type { MedicalRecordRepository, OwnerRepository, PetFilter, PetRepository } from './ports.js';

export interface PetProfile {
  pet: Pet;
  owner: Owner;
  history: MedicalRecord[];
}

export interface PatientQueriesDeps {
  owners: OwnerRepository;
  pets: PetRepository;
  records: MedicalRecordRepository;
}

/** Consultas de solo lectura del módulo (separadas de los comandos). */
export class PatientQueries {
  public constructor(private readonly deps: PatientQueriesDeps) {}

  public listOwners(): Promise<Owner[]> {
    return this.deps.owners.list();
  }

  public listPets(filter: PetFilter): Promise<Pet[]> {
    return this.deps.pets.list(filter);
  }

  public async getPetProfile(petId: string): Promise<PetProfile> {
    const pet = await this.deps.pets.findById(petId);
    if (!pet) {
      throw new NotFoundError('PET_NOT_FOUND', 'La mascota no está registrada.');
    }
    const owner = await this.deps.owners.findById(pet.ownerId);
    if (!owner) {
      throw new NotFoundError('OWNER_NOT_FOUND', 'El dueño de la mascota no existe.');
    }
    const history = await this.deps.records.listByPet(petId);
    return { pet, owner, history };
  }
}
