import { asRecord, requireEmail, requireText } from '../../../shared/validation.js';

export interface RegisterVetCommand {
  fullName: string;
  email: string;
  specialty: string;
}

export function parseRegisterVet(body: unknown): RegisterVetCommand {
  const input = asRecord(body);
  return {
    fullName: requireText(input.fullName, 'fullName', 120),
    email: requireEmail(input.email),
    specialty: requireText(input.specialty, 'specialty', 80),
  };
}
