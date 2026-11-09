import type { Clock } from '../../../shared/clock.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js';
import type { EventBus } from '../../../shared/eventBus.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import { addMinutes, assertValidDuration, type Appointment, type AppointmentModality } from '../domain/appointment.js';
import {
  APPOINTMENT_SCHEDULED,
  type AppointmentRepository,
  type AppointmentScheduledPayload,
  type MeetingRoomProvider,
  type PetDirectory,
  type VetDirectory,
} from './ports.js';

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

  public async execute(command: ScheduleAppointmentCommand): Promise<Appointment> {
    assertValidDuration(command.durationMinutes);

    const now = this.deps.clock.now();
    if (command.startsAt.getTime() <= now.getTime()) {
      throw new ValidationError('APPOINTMENT_IN_PAST', 'No se puede agendar una cita en el pasado.');
    }

    if (!(await this.deps.pets.exists(command.petId))) {
      throw new NotFoundError('PET_NOT_FOUND', 'La mascota no está registrada.');
    }
    if (!(await this.deps.vets.exists(command.vetId))) {
      throw new NotFoundError('VET_NOT_FOUND', 'El veterinario no existe.');
    }

    const endsAt = addMinutes(command.startsAt, command.durationMinutes);

    const vetClashes = await this.deps.repository.findActiveOverlappingForVet(command.vetId, command.startsAt, endsAt);
    if (vetClashes.length > 0) {
      throw new ConflictError('VET_BUSY', 'El veterinario ya tiene una cita en ese horario.');
    }
    const petClashes = await this.deps.repository.findActiveOverlappingForPet(command.petId, command.startsAt, endsAt);
    if (petClashes.length > 0) {
      throw new ConflictError('PET_BUSY', 'La mascota ya tiene otra cita en ese horario.');
    }

    const id = this.deps.ids.next();
    const meetingUrl = command.modality === 'TELEMEDICINE' ? await this.deps.meetingRooms.createRoomUrl(id) : null;

    const appointment: Appointment = {
      id,
      petId: command.petId,
      vetId: command.vetId,
      startsAt: command.startsAt,
      endsAt,
      modality: command.modality,
      reason: command.reason,
      status: 'SCHEDULED',
      meetingUrl,
      createdAt: now,
    };

    await this.deps.repository.save(appointment);
    await this.deps.events.publish<AppointmentScheduledPayload>({
      type: APPOINTMENT_SCHEDULED,
      occurredAt: now,
      payload: {
        appointmentId: appointment.id,
        petId: appointment.petId,
        vetId: appointment.vetId,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        modality: appointment.modality,
        meetingUrl: appointment.meetingUrl,
      },
    });

    return appointment;
  }
}
