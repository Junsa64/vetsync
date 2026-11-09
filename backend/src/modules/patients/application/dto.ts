import {
  asRecord,
  optionalDate,
  optionalText,
  requireEmail,
  requireText,
} from '../../../shared/validation.js';

export interface RegisterOwnerCommand {
  fullName: string;
  email: string;
  phone: string | null;
}

export interface RegisterPetCommand {
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: Date | null;
}

export interface AddMedicalRecordCommand {
  diagnosis: string;
  treatment: string | null;
  notes: string | null;
  vetId: string | null;
  recordedAt: Date | null;
}

export function parseRegisterOwner(body: unknown): RegisterOwnerCommand {
  const input = asRecord(body);
  return {
    fullName: requireText(input.fullName, 'fullName', 120),
    email: requireEmail(input.email),
    phone: optionalText(input.phone, 'phone', 30),
  };
}

export function parseRegisterPet(body: unknown): RegisterPetCommand {
  const input = asRecord(body);
  return {
    ownerId: requireText(input.ownerId, 'ownerId', 36),
    name: requireText(input.name, 'name', 80),
    species: requireText(input.species, 'species', 40),
    breed: optionalText(input.breed, 'breed', 80),
    birthDate: optionalDate(input.birthDate, 'birthDate'),
  };
}

export function parseAddMedicalRecord(body: unknown): AddMedicalRecordCommand {
  const input = asRecord(body);
  return {
    diagnosis: requireText(input.diagnosis, 'diagnosis', 255),
    treatment: optionalText(input.treatment, 'treatment', 2000),
    notes: optionalText(input.notes, 'notes', 2000),
    vetId: optionalText(input.vetId, 'vetId', 36),
    recordedAt: optionalDate(input.recordedAt, 'recordedAt'),
  };
}
