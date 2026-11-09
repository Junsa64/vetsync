/**
 * Puertos del módulo de notificaciones. Los define el propio módulo (el
 * consumidor), así que no importa nada de citas ni de pacientes: la raíz de
 * composición les conecta las APIs públicas de esos módulos.
 */

export type EmailKind = 'CONFIRMATION' | 'REMINDER';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  kind: EmailKind;
  appointmentId: string | null;
}

export interface SentEmail extends EmailMessage {
  id: string;
  sentAt: Date;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailOutbox {
  list(): Promise<SentEmail[]>;
}

export interface ReminderCandidate {
  appointmentId: string;
  petId: string;
  vetId: string;
  startsAt: Date;
  modality: string;
  meetingUrl: string | null;
}

export interface AppointmentFeed {
  findScheduledStartingBetween(from: Date, to: Date): Promise<ReminderCandidate[]>;
}

export interface PetContact {
  ownerName: string;
  ownerEmail: string;
  petName: string;
}

export interface ContactDirectory {
  getContactForPet(petId: string): Promise<PetContact | null>;
}

export interface VetNames {
  getVetName(vetId: string): Promise<string | null>;
}

/** Registro propio de recordatorios enviados (no escribe en la tabla de citas). */
export interface SentReminderRepository {
  wasSent(appointmentId: string): Promise<boolean>;
  markSent(appointmentId: string, sentAt: Date): Promise<void>;
}

export interface ScheduledAppointmentNotice {
  appointmentId: string;
  petId: string;
  vetId: string;
  startsAt: string;
  endsAt: string;
  modality: string;
  meetingUrl: string | null;
}
