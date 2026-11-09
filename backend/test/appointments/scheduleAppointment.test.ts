import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleAppointment,
  type ScheduleAppointmentCommand,
} from '../../src/modules/appointments/application/scheduleAppointment.js';
import { createModalityHandlers } from '../../src/modules/appointments/application/modalityHandlers.js';
import { InMemoryAppointmentRepository } from '../../src/modules/appointments/infrastructure/inMemoryAppointmentRepository.js';
import { APPOINTMENT_SCHEDULED } from '../../src/modules/appointments/application/ports.js';
import { KeyedMutex } from '../../src/shared/keyedMutex.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import {
  FakeMeetingRoomProvider,
  FixedClock,
  RecordingEventBus,
  SequentialIdGenerator,
  StubPetDirectory,
  StubVetDirectory,
  at,
} from '../support/fakes.js';

const NOW = at('2026-11-10T15:00:00.000Z');

function createSut() {
  const repository = new InMemoryAppointmentRepository();
  const eventBus = new RecordingEventBus();
  const useCase = new ScheduleAppointment({
    repository,
    pets: new StubPetDirectory(new Set(['pet-firulais', 'pet-michi'])),
    vets: new StubVetDirectory(new Set(['vet-ana', 'vet-luis'])),
    modalities: createModalityHandlers(new FakeMeetingRoomProvider()),
    clock: new FixedClock(NOW),
    ids: new SequentialIdGenerator('appt'),
    events: eventBus,
    locks: new KeyedMutex(),
  });
  return { useCase, repository, eventBus };
}

function command(overrides: Partial<ScheduleAppointmentCommand> = {}): ScheduleAppointmentCommand {
  return {
    petId: 'pet-firulais',
    vetId: 'vet-ana',
    startsAt: at('2026-11-11T16:00:00.000Z'),
    durationMinutes: 30,
    modality: 'IN_PERSON',
    reason: 'Vacuna anual',
    ...overrides,
  };
}

function isDomainError(type: typeof ConflictError | typeof NotFoundError | typeof ValidationError, code: string) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof type, `Se esperaba ${type.name} pero llegó ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  };
}

describe('agendarCita (ScheduleAppointment)', () => {
  it('agenda una cita válida y calcula la hora de fin', async () => {
    const { useCase, repository } = createSut();

    const appointment = await useCase.execute(command());

    assert.equal(appointment.status, 'SCHEDULED');
    assert.equal(appointment.endsAt.toISOString(), '2026-11-11T16:30:00.000Z');
    assert.equal(appointment.meetingUrl, null);
    assert.deepEqual(await repository.findById(appointment.id), appointment);
  });

  it('rechaza la cita si el veterinario ya está ocupado en ese horario', async () => {
    const { useCase } = createSut();
    await useCase.execute(command({ startsAt: at('2026-11-11T16:00:00.000Z'), durationMinutes: 60 }));

    await assert.rejects(
      useCase.execute(command({ petId: 'pet-michi', startsAt: at('2026-11-11T16:30:00.000Z') })),
      isDomainError(ConflictError, 'VET_BUSY'),
    );
  });

  it('rechaza una cita con fecha en el pasado', async () => {
    const { useCase } = createSut();

    await assert.rejects(
      useCase.execute(command({ startsAt: at('2026-11-10T14:59:00.000Z') })),
      isDomainError(ValidationError, 'APPOINTMENT_IN_PAST'),
    );
  });

  it('rechaza una cita para una mascota no registrada', async () => {
    const { useCase } = createSut();

    await assert.rejects(
      useCase.execute(command({ petId: 'pet-fantasma' })),
      isDomainError(NotFoundError, 'PET_NOT_FOUND'),
    );
  });

  it('rechaza una cita con un veterinario inexistente', async () => {
    const { useCase } = createSut();

    await assert.rejects(
      useCase.execute(command({ vetId: 'vet-fantasma' })),
      isDomainError(NotFoundError, 'VET_NOT_FOUND'),
    );
  });

  // ── Casos de borde adicionales ─────────────────────────────────
  it('permite citas contiguas: el fin de una es el inicio de la otra', async () => {
    const { useCase } = createSut();
    await useCase.execute(command({ startsAt: at('2026-11-11T16:00:00.000Z'), durationMinutes: 30 }));

    const next = await useCase.execute(
      command({ petId: 'pet-michi', startsAt: at('2026-11-11T16:30:00.000Z') }),
    );

    assert.equal(next.status, 'SCHEDULED');
  });

  it('detecta el choque cuando la nueva cita envuelve por completo a una existente', async () => {
    const { useCase } = createSut();
    await useCase.execute(command({ startsAt: at('2026-11-11T16:15:00.000Z'), durationMinutes: 15 }));

    await assert.rejects(
      useCase.execute(
        command({ petId: 'pet-michi', startsAt: at('2026-11-11T16:00:00.000Z'), durationMinutes: 60 }),
      ),
      isDomainError(ConflictError, 'VET_BUSY'),
    );
  });

  it('permite agendar con otro veterinario a la misma hora', async () => {
    const { useCase } = createSut();
    await useCase.execute(command());

    const other = await useCase.execute(command({ petId: 'pet-michi', vetId: 'vet-luis' }));

    assert.equal(other.vetId, 'vet-luis');
  });

  it('impide que la misma mascota tenga dos citas simultáneas con veterinarios distintos', async () => {
    const { useCase } = createSut();
    await useCase.execute(command());

    await assert.rejects(
      useCase.execute(command({ vetId: 'vet-luis' })),
      isDomainError(ConflictError, 'PET_BUSY'),
    );
  });

  it('rechaza duraciones fuera de 15 a 120 minutos o que no sean múltiplo de 15', async () => {
    const { useCase } = createSut();

    for (const durationMinutes of [0, 10, 20, 135, -15]) {
      await assert.rejects(
        useCase.execute(command({ durationMinutes })),
        isDomainError(ValidationError, 'INVALID_DURATION'),
        `duración ${durationMinutes} debió rechazarse`,
      );
    }
  });

  it('genera un enlace de videollamada cuando la cita es de telemedicina', async () => {
    const { useCase } = createSut();

    const appointment = await useCase.execute(command({ modality: 'TELEMEDICINE' }));

    assert.equal(appointment.meetingUrl, `https://meet.test/${appointment.id}`);
  });

  it('publica el evento appointment.scheduled para que otros módulos reaccionen', async () => {
    const { useCase, eventBus } = createSut();

    const appointment = await useCase.execute(command());

    assert.equal(eventBus.published.length, 1);
    const [event] = eventBus.published;
    assert.equal(event?.type, APPOINTMENT_SCHEDULED);
    assert.deepEqual(event?.payload, {
      appointmentId: appointment.id,
      petId: 'pet-firulais',
      vetId: 'vet-ana',
      startsAt: '2026-11-11T16:00:00.000Z',
      endsAt: '2026-11-11T16:30:00.000Z',
      modality: 'IN_PERSON',
      meetingUrl: null,
    });
  });
});
