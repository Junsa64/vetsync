import type { Clock } from '../../../shared/clock.js';
import type { EventBus } from '../../../shared/eventBus.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { Appointment, AppointmentModality } from '../domain/appointment.js';
import type { AppointmentRepository, MeetingRoomProvider, PetDirectory, VetDirectory } from './ports.js';

export interface ScheduleAppointmentCommand {
  petId: string;
  vetId: string;
  startsAt: Date;
  durationMinutes: number;
  modality: AppointmentModality;
  reason: string;
}

export interface ScheduleAppointmentDeps {
  repository: AppointmentRepository;
  pets: PetDirectory;
  vets: VetDirectory;
  meetingRooms: MeetingRoomProvider;
  clock: Clock;
  ids: IdGenerator;
  events: EventBus;
}

export class ScheduleAppointment {
  public constructor(private readonly deps: ScheduleAppointmentDeps) {}

  public async execute(_command: ScheduleAppointmentCommand): Promise<Appointment> {
    throw new Error('No implementado (fase roja de TDD)');
  }
}
