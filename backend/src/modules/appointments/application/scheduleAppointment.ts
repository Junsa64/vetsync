import type { Clock } from '../../../shared/clock.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js';
import type { EventBus } from '../../../shared/eventBus.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { KeyedLock } from '../../../shared/keyedMutex.js';
import { addMinutes, assertValidDuration, type Appointment, type AppointmentModality } from '../domain/appointment.js';
import type { ModalityHandlers } from './modalityHandlers.js';
import {
  APPOINTMENT_SCHEDULED,
  type AppointmentRepository,
  type AppointmentScheduledPayload,
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
  modalities: ModalityHandlers;
  clock: Clock;
  ids: IdGenerator;
  events: EventBus;
  /** Serializa agendamientos que compiten por el mismo veterinario o mascota. */
  locks: KeyedLock;
}

/** Caso de uso "agendarCita": agenda evitando choques de horario del veterinario y de la mascota. */
export class ScheduleAppointment {
  public constructor(private readonly deps: ScheduleAppointmentDeps) {}

  public async execute(command: ScheduleAppointmentCommand): Promise<Appointment> {
    const now = this.deps.clock.now();
    await this.assertSchedulable(command, now);

    // Revisar choques y guardar debe ser atómico: si no, dos solicitudes simultáneas
    // pasan la revisión y ambas se guardan (hallazgo del code review, Fase III).
    const appointment = await this.deps.locks.runExclusive(
      [`vet:${command.vetId}`, `pet:${command.petId}`],
      () => this.reserve(command, now),
    );

    await this.publishScheduled(appointment, now);
    return appointment;
  }

  private async reserve(command: ScheduleAppointmentCommand, now: Date): Promise<Appointment> {
    const endsAt = addMinutes(command.startsAt, command.durationMinutes);
    await this.assertNoClashes(command, endsAt);

    const id = this.deps.ids.next();
    const { meetingUrl } = await this.deps.modalities[command.modality].prepare(id);
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
    return appointment;
  }

  private async assertSchedulable(command: ScheduleAppointmentCommand, now: Date): Promise<void> {
    assertValidDuration(command.durationMinutes);
    if (command.startsAt.getTime() <= now.getTime()) {
      throw new ValidationError('APPOINTMENT_IN_PAST', 'No se puede agendar una cita en el pasado.');
    }
    if (!(await this.deps.pets.exists(command.petId))) {
      throw new NotFoundError('PET_NOT_FOUND', 'La mascota no está registrada.');
    }
    if (!(await this.deps.vets.exists(command.vetId))) {
      throw new NotFoundError('VET_NOT_FOUND', 'El veterinario no existe.');
    }
  }

  private async assertNoClashes(command: ScheduleAppointmentCommand, endsAt: Date): Promise<void> {
    const { repository } = this.deps;
    if ((await repository.findActiveOverlappingForVet(command.vetId, command.startsAt, endsAt)).length > 0) {
      throw new ConflictError('VET_BUSY', 'El veterinario ya tiene una cita en ese horario.');
    }
    if ((await repository.findActiveOverlappingForPet(command.petId, command.startsAt, endsAt)).length > 0) {
      throw new ConflictError('PET_BUSY', 'La mascota ya tiene otra cita en ese horario.');
    }
  }

  private async publishScheduled(appointment: Appointment, now: Date): Promise<void> {
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
  }
}
