import type { Appointment } from '../domain/appointment.js';

export interface AppointmentFilter {
  vetId?: string;
  petId?: string;
  from?: Date;
  to?: Date;
}

/** Persistencia de citas. Cualquier implementación (memoria, MySQL) debe pasar las mismas pruebas. */
export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  /** Citas activas (SCHEDULED) del veterinario que se traslapan con [start, end). */
  findActiveOverlappingForVet(vetId: string, start: Date, end: Date): Promise<Appointment[]>;
  /** Citas activas (SCHEDULED) de la mascota que se traslapan con [start, end). */
  findActiveOverlappingForPet(petId: string, start: Date, end: Date): Promise<Appointment[]>;
  /** Citas programadas cuyo inicio cae en [from, to). Usado por recordatorios. */
  findScheduledStartingBetween(from: Date, to: Date): Promise<Appointment[]>;
  list(filter: AppointmentFilter): Promise<Appointment[]>;
}

/** Lo único que Citas necesita saber del módulo de pacientes (ISP). */
export interface PetDirectory {
  exists(petId: string): Promise<boolean>;
}

/** Lo único que Citas necesita saber del módulo de veterinarios (ISP). */
export interface VetDirectory {
  exists(vetId: string): Promise<boolean>;
}

/** Proveedor de sala de videollamada para telemedicina (simulado). */
export interface MeetingRoomProvider {
  createRoomUrl(appointmentId: string): Promise<string>;
}

export const APPOINTMENT_SCHEDULED = 'appointment.scheduled';

export interface AppointmentScheduledPayload {
  appointmentId: string;
  petId: string;
  vetId: string;
  startsAt: string;
  endsAt: string;
  modality: string;
  meetingUrl: string | null;
}
