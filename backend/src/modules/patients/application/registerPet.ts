import type { Clock } from '../../../shared/clock.js';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { Pet } from '../domain/patients.js';
import type { RegisterPetCommand } from './dto.js';
import type { OwnerRepository, PetRepository } from './ports.js';

export interface RegisterPetDeps {
  owners: OwnerRepository;
  pets: PetRepository;
  clock: Clock;
  ids: IdGenerator;
}

export class RegisterPet {
  public constructor(private readonly deps: RegisterPetDeps) {}

  public async execute(command: RegisterPetCommand): Promise<Pet> {
    if (!(await this.deps.owners.findById(command.ownerId))) {
      throw new NotFoundError('OWNER_NOT_FOUND', 'El dueño no está registrado.');
    }
    const now = this.deps.clock.now();
    if (command.birthDate && command.birthDate.getTime() > now.getTime()) {
      throw new ValidationError('INVALID_BIRTH_DATE', 'La fecha de nacimiento no puede estar en el futuro.');
    }
    const pet: Pet = {
      id: this.deps.ids.next(),
      ownerId: command.ownerId,
      name: command.name,
      species: command.species,
      breed: command.breed,
      birthDate: command.birthDate,
      createdAt: now,
    };
    await this.deps.pets.save(pet);
    return pet;
  }
}
