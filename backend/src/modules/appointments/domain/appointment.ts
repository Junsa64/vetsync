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
