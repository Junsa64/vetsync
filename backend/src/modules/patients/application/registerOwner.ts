import type { Clock } from '../../../shared/clock.js';
import { ConflictError } from '../../../shared/errors.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { Owner } from '../domain/patients.js';
import type { RegisterOwnerCommand } from './dto.js';
import type { OwnerRepository } from './ports.js';

export interface RegisterOwnerDeps {
  owners: OwnerRepository;
  clock: Clock;
  ids: IdGenerator;
}

export class RegisterOwner {
  public constructor(private readonly deps: RegisterOwnerDeps) {}

  public async execute(command: RegisterOwnerCommand): Promise<Owner> {
    if (await this.deps.owners.findByEmail(command.email)) {
      throw new ConflictError('OWNER_EMAIL_TAKEN', 'Ya existe un dueño con ese correo.');
    }
    const owner: Owner = {
      id: this.deps.ids.next(),
      fullName: command.fullName,
      email: command.email,
      phone: command.phone,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.owners.save(owner);
    return owner;
  }
}
