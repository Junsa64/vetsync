import type { EmailMessage, PetContact } from '../application/ports.js';

export interface AppointmentEmailData {
  appointmentId: string;
  contact: PetContact;
  vetName: string | null;
  startsAt: Date;
  meetingUrl: string | null;
  timeZone: string;
}

const FALLBACK_VET_NAME = 'tu veterinario';

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(date);
}

function locationLine(meetingUrl: string | null): string {
  return meetingUrl
    ? `Es una consulta de telemedicina. Entra a la videollamada aquí: ${meetingUrl}`
    : 'Te esperamos en la clínica 10 minutos antes.';
}

export function buildReminderEmail(data: AppointmentEmailData): EmailMessage {
  const when = formatDateTime(data.startsAt, data.timeZone);
  return {
    to: data.contact.ownerEmail,
    subject: `Recordatorio: cita de ${data.contact.petName} — ${when}`,
    body: [
      `Hola ${data.contact.ownerName}:`,
      '',
      `Te recordamos que ${data.contact.petName} tiene cita con ${data.vetName ?? FALLBACK_VET_NAME} el ${when}.`,
      locationLine(data.meetingUrl),
      '',
      '— VetSync',
    ].join('\n'),
    kind: 'REMINDER',
    appointmentId: data.appointmentId,
  };
}

export function buildConfirmationEmail(data: AppointmentEmailData): EmailMessage {
  const when = formatDateTime(data.startsAt, data.timeZone);
  return {
    to: data.contact.ownerEmail,
    subject: `Cita confirmada para ${data.contact.petName}`,
    body: [
      `Hola ${data.contact.ownerName}:`,
      '',
      `Agendamos la cita de ${data.contact.petName} con ${data.vetName ?? FALLBACK_VET_NAME} para el ${when}.`,
      locationLine(data.meetingUrl),
      '',
      '— VetSync',
    ].join('\n'),
    kind: 'CONFIRMATION',
    appointmentId: data.appointmentId,
  };
}
