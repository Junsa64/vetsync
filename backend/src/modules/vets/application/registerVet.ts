import type { Clock } from '../../../shared/clock.js';
import { ConflictError } from '../../../shared/errors.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { Vet } from '../domain/vet.js';
import type { RegisterVetCommand } from './dto.js';
import type { VetRepository } from './ports.js';

export interface RegisterVetDeps {
  vets: VetRepository;
  clock: Clock;
  ids: IdGenerator;
}

export class RegisterVet {
  public constructor(private readonly deps: RegisterVetDeps) {}

  public async execute(command: RegisterVetCommand): Promise<Vet> {
    if (await this.deps.vets.findByEmail(command.email)) {
      throw new ConflictError('VET_EMAIL_TAKEN', 'Ya existe un veterinario con ese correo.');
    }
    const vet: Vet = {
      id: this.deps.ids.next(),
      fullName: command.fullName,
      email: command.email,
      specialty: command.specialty,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.vets.save(vet);
    return vet;
  }
}
