import { ConflictError, ValidationError } from '../../../shared/errors.js';

export const APPOINTMENT_MODALITIES = ['IN_PERSON', 'TELEMEDICINE'] as const;
export type AppointmentModality = (typeof APPOINTMENT_MODALITIES)[number];

export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  readonly id: string;
  readonly petId: string;
  readonly vetId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly modality: AppointmentModality;
  readonly reason: string;
  readonly status: AppointmentStatus;
  readonly meetingUrl: string | null;
  readonly createdAt: Date;
}

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 120;
export const DURATION_STEP_MINUTES = 15;

const MS_PER_MINUTE = 60_000;

export function assertValidDuration(minutes: number): void {
  const isValid =
    Number.isInteger(minutes) &&
    minutes >= MIN_DURATION_MINUTES &&
    minutes <= MAX_DURATION_MINUTES &&
    minutes % DURATION_STEP_MINUTES === 0;
  if (!isValid) {
    throw new ValidationError(
      'INVALID_DURATION',
      `La duración debe ser de ${MIN_DURATION_MINUTES} a ${MAX_DURATION_MINUTES} minutos, en bloques de ${DURATION_STEP_MINUTES}.`,
    );
  }
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

/**
 * Dos intervalos semiabiertos [a, b) y [c, d) se traslapan si a < d y c < b.
 * Así, una cita que termina a las 16:30 NO choca con otra que empieza a las 16:30.
 */
export function overlaps(appointment: Pick<Appointment, 'startsAt' | 'endsAt'>, start: Date, end: Date): boolean {
  return appointment.startsAt.getTime() < end.getTime() && start.getTime() < appointment.endsAt.getTime();
}

export function cancel(appointment: Appointment): Appointment {
  if (appointment.status !== 'SCHEDULED') {
    throw new ConflictError('APPOINTMENT_NOT_ACTIVE', 'Solo se pueden cancelar citas programadas.');
  }
  return { ...appointment, status: 'CANCELLED' };
}
