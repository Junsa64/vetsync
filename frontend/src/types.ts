/** Contratos de la API (las fechas llegan como cadenas ISO 8601). */
export interface Owner {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
}

export interface Vet {
  id: string;
  fullName: string;
  email: string;
  specialty: string;
}

export type Modality = 'IN_PERSON' | 'TELEMEDICINE';

export interface Appointment {
  id: string;
  petId: string;
  vetId: string;
  startsAt: string;
  endsAt: string;
  modality: Modality;
  reason: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  meetingUrl: string | null;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  vetId: string | null;
  recordedAt: string;
  diagnosis: string;
  treatment: string | null;
  notes: string | null;
}

export interface PetProfile {
  pet: Pet;
  owner: Owner;
  history: MedicalRecord[];
}

export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  kind: 'CONFIRMATION' | 'REMINDER';
  appointmentId: string | null;
  sentAt: string;
}

export interface ReminderRunResult {
  sent: number;
  skipped: number;
  failed: number;
}
