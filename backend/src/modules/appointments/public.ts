/** Única puerta de entrada al módulo de citas para otros módulos (solo lectura). */
import type { AppointmentModality } from './domain/appointment.js';
import type { AppointmentRepository } from './application/ports.js';

export { APPOINTMENT_SCHEDULED, type AppointmentScheduledPayload } from './application/ports.js';

export interface UpcomingAppointment {
  appointmentId: string;
  petId: string;
  vetId: string;
  startsAt: Date;
  modality: AppointmentModality;
  meetingUrl: string | null;
}

export interface AppointmentsPublicApi {
  findScheduledStartingBetween(from: Date, to: Date): Promise<UpcomingAppointment[]>;
}

export function createAppointmentsPublicApi(deps: { repository: AppointmentRepository }): AppointmentsPublicApi {
  return {
    async findScheduledStartingBetween(from: Date, to: Date): Promise<UpcomingAppointment[]> {
      const appointments = await deps.repository.findScheduledStartingBetween(from, to);
      return appointments.map((a) => ({
        appointmentId: a.id,
        petId: a.petId,
        vetId: a.vetId,
        startsAt: a.startsAt,
        modality: a.modality,
        meetingUrl: a.meetingUrl,
      }));
    },
  };
}
