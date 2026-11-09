import type { Clock } from '../../../shared/clock.js';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { MedicalRecord } from '../domain/patients.js';
import type { AddMedicalRecordCommand } from './dto.js';
import type { MedicalRecordRepository, PetRepository } from './ports.js';

export interface AddMedicalRecordDeps {
  pets: PetRepository;
  records: MedicalRecordRepository;
  clock: Clock;
  ids: IdGenerator;
}

export class AddMedicalRecord {
  public constructor(private readonly deps: AddMedicalRecordDeps) {}

  public async execute(command: AddMedicalRecordCommand, petId: string): Promise<MedicalRecord> {
    if (!(await this.deps.pets.findById(petId))) {
      throw new NotFoundError('PET_NOT_FOUND', 'La mascota no está registrada.');
    }
    const now = this.deps.clock.now();
    const recordedAt = command.recordedAt ?? now;
    if (recordedAt.getTime() > now.getTime()) {
      throw new ValidationError('RECORD_IN_FUTURE', 'No se puede registrar una consulta con fecha futura.');
    }
    const record: MedicalRecord = {
      id: this.deps.ids.next(),
      petId,
      vetId: command.vetId,
      recordedAt,
      diagnosis: command.diagnosis,
      treatment: command.treatment,
      notes: command.notes,
    };
    await this.deps.records.add(record);
    return record;
  }
}
