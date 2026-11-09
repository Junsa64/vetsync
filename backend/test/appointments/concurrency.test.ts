import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleAppointment } from '../../src/modules/appointments/application/scheduleAppointment.js';
import { createModalityHandlers } from '../../src/modules/appointments/application/modalityHandlers.js';
import { InMemoryAppointmentRepository } from '../../src/modules/appointments/infrastructure/inMemoryAppointmentRepository.js';
import { KeyedMutex } from '../../src/shared/keyedMutex.js';
import { ConflictError } from '../../src/shared/errors.js';
import {
  FakeMeetingRoomProvider,
  FixedClock,
  RecordingEventBus,
  SequentialIdGenerator,
  StubPetDirectory,
  StubVetDirectory,
  at,
} from '../support/fakes.js';

/** Hallazgo del code review (Fase III): condición de carrera "check-then-act". */
describe('agendarCita bajo concurrencia', () => {
  it('dos solicitudes simultáneas por el mismo horario: solo una se agenda', async () => {
    const repository = new InMemoryAppointmentRepository();
    const useCase = new ScheduleAppointment({
      repository,
      pets: new StubPetDirectory(new Set(['pet-a', 'pet-b'])),
      vets: new StubVetDirectory(new Set(['vet-1'])),
      modalities: createModalityHandlers(new FakeMeetingRoomProvider()),
      clock: new FixedClock(at('2026-11-10T15:00:00Z')),
      ids: new SequentialIdGenerator('appt'),
      events: new RecordingEventBus(),
      locks: new KeyedMutex(),
    });
    const base = { vetId: 'vet-1', startsAt: at('2026-11-11T16:00:00Z'), durationMinutes: 30, modality: 'IN_PERSON' as const, reason: 'x' };

    const results = await Promise.allSettled([
      useCase.execute({ ...base, petId: 'pet-a' }),
      useCase.execute({ ...base, petId: 'pet-b' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactamente una cita debe quedar agendada');
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]?.reason instanceof ConflictError);
    assert.equal((await repository.list({ vetId: 'vet-1' })).length, 1);
  });
});
