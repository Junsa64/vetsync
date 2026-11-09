import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleAppointment } from '../../src/modules/appointments/application/scheduleAppointment.js';
import { CancelAppointment } from '../../src/modules/appointments/application/cancelAppointment.js';
import { AppointmentQueries } from '../../src/modules/appointments/application/appointmentQueries.js';
import { parseAppointmentFilter, parseScheduleAppointment } from '../../src/modules/appointments/application/dto.js';
import { InMemoryAppointmentRepository } from '../../src/modules/appointments/infrastructure/inMemoryAppointmentRepository.js';
import { createAppointmentsPublicApi } from '../../src/modules/appointments/public.js';
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

function createSut() {
  const repository = new InMemoryAppointmentRepository();
  const schedule = new ScheduleAppointment({
    repository,
    pets: new StubPetDirectory(new Set(['pet-1', 'pet-2'])),
    vets: new StubVetDirectory(new Set(['vet-1', 'vet-2'])),
    meetingRooms: new FakeMeetingRoomProvider(),
    clock: new FixedClock(at('2026-11-10T15:00:00Z')),
    ids: new SequentialIdGenerator('appt'),
    events: new RecordingEventBus(),
  });
  return {
    repository,
    schedule,
    cancel: new CancelAppointment({ repository }),
    queries: new AppointmentQueries({ repository }),
    api: createAppointmentsPublicApi({ repository }),
  };
}

const slot = { petId: 'pet-1', vetId: 'vet-1', startsAt: at('2026-11-11T16:00:00Z'), durationMinutes: 30, modality: 'IN_PERSON' as const, reason: 'Consulta' };

describe('Cancelación y consultas de citas', () => {
  it('cancelar libera el horario para otra mascota', async () => {
    const { schedule, cancel } = createSut();
    const first = await schedule.execute(slot);

    const cancelled = await cancel.execute(first.id);
    const again = await schedule.execute({ ...slot, petId: 'pet-2' });

    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(again.status, 'SCHEDULED');
  });

  it('no permite cancelar dos veces ni cancelar una cita inexistente', async () => {
    const { schedule, cancel } = createSut();
    const appointment = await schedule.execute(slot);
    await cancel.execute(appointment.id);

    await assert.rejects(
      cancel.execute(appointment.id),
      (error: unknown) => error instanceof ConflictError && error.code === 'APPOINTMENT_NOT_ACTIVE',
    );
    await assert.rejects(
      cancel.execute('nope'),
      (error: unknown) => error instanceof NotFoundError && error.code === 'APPOINTMENT_NOT_FOUND',
    );
  });

  it('lista citas filtradas por veterinario y rango, ordenadas por hora', async () => {
    const { schedule, queries } = createSut();
    await schedule.execute({ ...slot, startsAt: at('2026-11-11T18:00:00Z') });
    await schedule.execute({ ...slot, startsAt: at('2026-11-11T16:00:00Z') });
    await schedule.execute({ ...slot, petId: 'pet-2', vetId: 'vet-2' });
    await schedule.execute({ ...slot, startsAt: at('2026-11-12T16:00:00Z') });

    const result = await queries.list(
      parseAppointmentFilter({ vetId: 'vet-1', from: '2026-11-11T00:00:00Z', to: '2026-11-12T00:00:00Z' }),
    );

    assert.deepEqual(
      result.map((a) => a.startsAt.toISOString()),
      ['2026-11-11T16:00:00.000Z', '2026-11-11T18:00:00.000Z'],
    );
    assert.equal((await queries.list(parseAppointmentFilter({ petId: 'pet-2' }))).length, 1);
    assert.equal((await queries.list(parseAppointmentFilter(undefined))).length, 4);
  });

  it('la API pública entrega solo citas programadas dentro de la ventana', async () => {
    const { schedule, cancel, api } = createSut();
    const kept = await schedule.execute(slot);
    const dropped = await schedule.execute({ ...slot, petId: 'pet-2', vetId: 'vet-2' });
    await cancel.execute(dropped.id);
    await schedule.execute({ ...slot, startsAt: at('2026-11-13T16:00:00Z') });

    const upcoming = await api.findScheduledStartingBetween(at('2026-11-11T00:00:00Z'), at('2026-11-12T00:00:00Z'));

    assert.deepEqual(upcoming.map((a) => a.appointmentId), [kept.id]);
    assert.equal(upcoming[0]?.startsAt.toISOString(), '2026-11-11T16:00:00.000Z');
  });
});

describe('DTO de agendamiento', () => {
  it('convierte el cuerpo HTTP en un comando tipado', () => {
    const parsed = parseScheduleAppointment({
      petId: 'pet-1',
      vetId: 'vet-1',
      startsAt: '2026-11-11T16:00:00Z',
      durationMinutes: '45',
      modality: 'TELEMEDICINE',
      reason: '  Seguimiento  ',
    });

    assert.equal(parsed.durationMinutes, 45);
    assert.equal(parsed.reason, 'Seguimiento');
    assert.equal(parsed.startsAt.toISOString(), '2026-11-11T16:00:00.000Z');
  });

  it('rechaza modalidad desconocida, fecha inválida y duración no numérica', () => {
    const base = { petId: 'p', vetId: 'v', startsAt: '2026-11-11T16:00:00Z', durationMinutes: 30, modality: 'IN_PERSON', reason: 'x' };
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...base, modality: 'PALOMA_MENSAJERA' }, 'INVALID_OPTION'],
      [{ ...base, startsAt: 'mañana' }, 'INVALID_DATE'],
      [{ ...base, durationMinutes: 'media hora' }, 'INVALID_NUMBER'],
    ];
    for (const [body, code] of cases) {
      assert.throws(
        () => parseScheduleAppointment(body),
        (error: unknown) => error instanceof ValidationError && error.code === code,
      );
    }
  });
});
