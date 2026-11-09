/**
 * Raíz de composición: el ÚNICO lugar que conoce las implementaciones concretas.
 * Para pasar a MySQL se cambian aquí los repositorios en memoria por adaptadores
 * MySQL; dominio, casos de uso y rutas no se tocan (DIP).
 */
import { SystemClock, type Clock } from './shared/clock.js';
import { ConsoleErrorReporter, InMemoryEventBus, type ErrorReporter } from './shared/eventBus.js';
import { UuidGenerator, type IdGenerator } from './shared/idGenerator.js';

import { AddMedicalRecord } from './modules/patients/application/addMedicalRecord.js';
import { PatientQueries } from './modules/patients/application/patientQueries.js';
import { RegisterOwner } from './modules/patients/application/registerOwner.js';
import { RegisterPet } from './modules/patients/application/registerPet.js';
import {
  InMemoryMedicalRecordRepository,
  InMemoryOwnerRepository,
  InMemoryPetRepository,
} from './modules/patients/infrastructure/inMemoryPatientRepositories.js';
import { createPatientsPublicApi } from './modules/patients/public.js';

import { RegisterVet } from './modules/vets/application/registerVet.js';
import { VetQueries } from './modules/vets/application/vetQueries.js';
import { InMemoryVetRepository } from './modules/vets/infrastructure/inMemoryVetRepository.js';
import { createVetsPublicApi } from './modules/vets/public.js';

import { AppointmentQueries } from './modules/appointments/application/appointmentQueries.js';
import { CancelAppointment } from './modules/appointments/application/cancelAppointment.js';
import { createModalityHandlers } from './modules/appointments/application/modalityHandlers.js';
import { ScheduleAppointment } from './modules/appointments/application/scheduleAppointment.js';
import { InMemoryAppointmentRepository } from './modules/appointments/infrastructure/inMemoryAppointmentRepository.js';
import { SimulatedMeetingRoomProvider } from './modules/appointments/infrastructure/simulatedMeetingRoomProvider.js';
import {
  APPOINTMENT_SCHEDULED,
  createAppointmentsPublicApi,
  type AppointmentScheduledPayload,
} from './modules/appointments/public.js';

import { SendAppointmentConfirmation } from './modules/notifications/application/sendAppointmentConfirmation.js';
import { SendAppointmentReminders } from './modules/notifications/application/sendAppointmentReminders.js';
import { InMemorySentReminderRepository } from './modules/notifications/infrastructure/inMemorySentReminderRepository.js';
import { SimulatedEmailSender } from './modules/notifications/infrastructure/simulatedEmailSender.js';

export interface ContainerOptions {
  clock?: Clock;
  ids?: IdGenerator;
  errors?: ErrorReporter;
  log?: (line: string) => void;
  timeZone?: string;
  reminderLeadMinutes?: number;
  meetingBaseUrl?: string;
}

export function buildContainer(options: ContainerOptions = {}) {
  const clock = options.clock ?? new SystemClock();
  const ids = options.ids ?? new UuidGenerator();
  const errors = options.errors ?? new ConsoleErrorReporter();
  const timeZone = options.timeZone ?? 'America/Hermosillo';
  const events = new InMemoryEventBus(errors);

  // ── patients ──
  const owners = new InMemoryOwnerRepository();
  const pets = new InMemoryPetRepository();
  const records = new InMemoryMedicalRecordRepository();
  const patientsApi = createPatientsPublicApi({ owners, pets });
  const patients = {
    registerOwner: new RegisterOwner({ owners, clock, ids }),
    registerPet: new RegisterPet({ owners, pets, clock, ids }),
    addMedicalRecord: new AddMedicalRecord({ pets, records, clock, ids }),
    queries: new PatientQueries({ owners, pets, records }),
  };

  // ── vets ──
  const vetRepository = new InMemoryVetRepository();
  const vetsApi = createVetsPublicApi({ vets: vetRepository });
  const vets = {
    registerVet: new RegisterVet({ vets: vetRepository, clock, ids }),
    queries: new VetQueries({ vets: vetRepository }),
  };

  // ── appointments ── (los puertos de otros módulos se conectan aquí)
  const appointmentRepository = new InMemoryAppointmentRepository();
  const appointmentsApi = createAppointmentsPublicApi({ repository: appointmentRepository });
  const appointments = {
    schedule: new ScheduleAppointment({
      repository: appointmentRepository,
      pets: { exists: (petId) => patientsApi.petExists(petId) },
      vets: { exists: (vetId) => vetsApi.vetExists(vetId) },
      modalities: createModalityHandlers(
        new SimulatedMeetingRoomProvider(options.meetingBaseUrl ?? 'https://meet.vetsync.local/sala'),
      ),
      clock,
      ids,
      events,
    }),
    cancel: new CancelAppointment({ repository: appointmentRepository }),
    queries: new AppointmentQueries({ repository: appointmentRepository }),
  };

  // ── notifications ──
  const mailer = new SimulatedEmailSender({ clock, ids, log: options.log ?? ((line) => console.info(line)) });
  const sendReminders = new SendAppointmentReminders({
    feed: appointmentsApi,
    contacts: patientsApi,
    vetNames: vetsApi,
    mailer,
    sentReminders: new InMemorySentReminderRepository(),
    clock,
    errors,
    leadTimeMinutes: options.reminderLeadMinutes ?? 24 * 60,
    timeZone,
  });
  const confirmation = new SendAppointmentConfirmation({ contacts: patientsApi, vetNames: vetsApi, mailer, timeZone });
  events.subscribe<AppointmentScheduledPayload>(APPOINTMENT_SCHEDULED, (event) => confirmation.handle(event.payload));

  return {
    clock,
    errors,
    patients,
    vets,
    appointments,
    notifications: { sendReminders, outbox: mailer },
  };
}

export type Container = ReturnType<typeof buildContainer>;
