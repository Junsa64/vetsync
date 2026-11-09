import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { SendAppointmentReminders } from '../../src/modules/notifications/application/sendAppointmentReminders.js';
import { SendAppointmentConfirmation } from '../../src/modules/notifications/application/sendAppointmentConfirmation.js';
import type {
  AppointmentFeed,
  ContactDirectory,
  EmailMessage,
  EmailSender,
  ReminderCandidate,
  VetNames,
} from '../../src/modules/notifications/application/ports.js';
import { SimulatedEmailSender } from '../../src/modules/notifications/infrastructure/simulatedEmailSender.js';
import { InMemorySentReminderRepository } from '../../src/modules/notifications/infrastructure/inMemorySentReminderRepository.js';
import { ReminderScheduler } from '../../src/modules/notifications/infrastructure/reminderScheduler.js';
import type { ErrorReporter } from '../../src/shared/eventBus.js';
import { FixedClock, SequentialIdGenerator, at } from '../support/fakes.js';

const NOW = at('2026-11-10T15:00:00.000Z');

class FakeFeed implements AppointmentFeed {
  public constructor(private readonly items: ReminderCandidate[]) {}

  public async findScheduledStartingBetween(from: Date, to: Date): Promise<ReminderCandidate[]> {
    return this.items.filter((i) => i.startsAt >= from && i.startsAt < to);
  }
}

const contacts: ContactDirectory = {
  async getContactForPet(petId: string) {
    return petId === 'pet-huerfano' ? null : { ownerName: 'Julian', ownerEmail: 'julian@correo.mx', petName: 'Firulais' };
  },
};

const vetNames: VetNames = {
  async getVetName(vetId: string) {
    return vetId === 'vet-ana' ? 'Dra. Ana López' : null;
  },
};

class RecordingMailer implements EmailSender {
  public readonly sent: EmailMessage[] = [];
  public failNext = 0;

  public async send(message: EmailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('SMTP caído');
    }
    this.sent.push(message);
  }
}

class RecordingReporter implements ErrorReporter {
  public readonly reports: string[] = [];

  public report(context: string, error: unknown): void {
    this.reports.push(`${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    appointmentId: 'appt-1',
    petId: 'pet-firulais',
    vetId: 'vet-ana',
    startsAt: at('2026-11-11T10:00:00.000Z'),
    modality: 'IN_PERSON',
    meetingUrl: null,
    ...overrides,
  };
}

function createSut(items: ReminderCandidate[]) {
  const mailer = new RecordingMailer();
  const reporter = new RecordingReporter();
  const useCase = new SendAppointmentReminders({
    feed: new FakeFeed(items),
    contacts,
    vetNames,
    mailer,
    sentReminders: new InMemorySentReminderRepository(),
    clock: new FixedClock(NOW),
    errors: reporter,
    leadTimeMinutes: 24 * 60,
    timeZone: 'America/Hermosillo',
  });
  return { useCase, mailer, reporter };
}

describe('Recordatorios de citas próximas (correo simulado)', () => {
  it('envía un recordatorio al dueño cuando la cita empieza dentro de las próximas 24 h', async () => {
    const { useCase, mailer } = createSut([candidate()]);

    const result = await useCase.execute();

    assert.deepEqual(result, { sent: 1, skipped: 0, failed: 0 });
    const [email] = mailer.sent;
    assert.equal(email?.to, 'julian@correo.mx');
    assert.equal(email?.kind, 'REMINDER');
    assert.match(email?.subject ?? '', /Firulais/);
    assert.match(email?.body ?? '', /Dra\. Ana López/);
    // 10:00 UTC = 03:00 en Hermosillo (UTC-7)
    assert.match(email?.body ?? '', /3:00/);
    // "p.m."/"a.m." ya terminan en punto: no debe quedar ".."
    assert.doesNotMatch(email?.body ?? '', /\.\./);
  });

  it('no envía recordatorios de citas que empiezan después de la ventana de 24 h', async () => {
    const { useCase, mailer } = createSut([candidate({ startsAt: at('2026-11-11T16:00:00.000Z') })]);

    const result = await useCase.execute();

    assert.equal(result.sent, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('es idempotente: dos corridas seguidas envían un solo correo por cita', async () => {
    const { useCase, mailer } = createSut([candidate()]);

    await useCase.execute();
    const second = await useCase.execute();

    assert.deepEqual(second, { sent: 0, skipped: 1, failed: 0 });
    assert.equal(mailer.sent.length, 1);
  });

  it('si el envío falla lo reporta, sigue con las demás y lo reintenta en la siguiente corrida', async () => {
    const { useCase, mailer, reporter } = createSut([
      candidate({ appointmentId: 'appt-1' }),
      candidate({ appointmentId: 'appt-2', petId: 'pet-otro' }),
    ]);
    mailer.failNext = 1;

    const first = await useCase.execute();
    const retry = await useCase.execute();

    assert.deepEqual(first, { sent: 1, skipped: 0, failed: 1 });
    assert.deepEqual(retry, { sent: 1, skipped: 1, failed: 0 });
    assert.equal(reporter.reports.length, 1);
    assert.match(reporter.reports[0] ?? '', /SMTP caído/);
  });

  it('omite y reporta la cita cuando no encuentra el contacto del dueño', async () => {
    const { useCase, mailer, reporter } = createSut([candidate({ petId: 'pet-huerfano' })]);

    const result = await useCase.execute();

    assert.deepEqual(result, { sent: 0, skipped: 0, failed: 1 });
    assert.equal(mailer.sent.length, 0);
    assert.match(reporter.reports[0] ?? '', /sin contacto/);
  });

  it('incluye el enlace de la videollamada cuando la cita es de telemedicina', async () => {
    const { useCase, mailer } = createSut([
      candidate({ modality: 'TELEMEDICINE', meetingUrl: 'https://meet.test/appt-1', vetId: 'vet-sin-nombre' }),
    ]);

    await useCase.execute();

    assert.match(mailer.sent[0]?.body ?? '', /https:\/\/meet\.test\/appt-1/);
    assert.match(mailer.sent[0]?.body ?? '', /tu veterinario/);
  });
});

describe('Confirmación al agendar', () => {
  it('envía un correo de confirmación cuando se publica appointment.scheduled', async () => {
    const mailer = new RecordingMailer();
    const handler = new SendAppointmentConfirmation({ contacts, vetNames, mailer, timeZone: 'America/Hermosillo' });

    await handler.handle({
      appointmentId: 'appt-9',
      petId: 'pet-firulais',
      vetId: 'vet-ana',
      startsAt: '2026-11-11T16:00:00.000Z',
      endsAt: '2026-11-11T16:30:00.000Z',
      modality: 'IN_PERSON',
      meetingUrl: null,
    });

    assert.equal(mailer.sent[0]?.kind, 'CONFIRMATION');
    assert.equal(mailer.sent[0]?.appointmentId, 'appt-9');
    assert.match(mailer.sent[0]?.body ?? '', /9:00/);
  });

  it('lanza un error (que el bus reporta) si no hay contacto para la mascota', async () => {
    const handler = new SendAppointmentConfirmation({ contacts, vetNames, mailer: new RecordingMailer(), timeZone: 'UTC' });

    await assert.rejects(
      handler.handle({
        appointmentId: 'appt-9',
        petId: 'pet-huerfano',
        vetId: 'vet-ana',
        startsAt: '2026-11-11T16:00:00.000Z',
        endsAt: '2026-11-11T16:30:00.000Z',
        modality: 'IN_PERSON',
        meetingUrl: null,
      }),
      /sin contacto/,
    );
  });
});

describe('Infraestructura de notificaciones', () => {
  it('el correo simulado guarda los mensajes en una bandeja, del más nuevo al más viejo', async () => {
    const clock = new FixedClock(NOW);
    const lines: string[] = [];
    const sender = new SimulatedEmailSender({ clock, ids: new SequentialIdGenerator('mail'), log: (line) => lines.push(line) });

    await sender.send({ to: 'a@b.mx', subject: 'Uno', body: '...', kind: 'CONFIRMATION', appointmentId: null });
    clock.advanceMinutes(1);
    await sender.send({ to: 'a@b.mx', subject: 'Dos', body: '...', kind: 'REMINDER', appointmentId: 'x' });

    const outbox = await sender.list();
    assert.deepEqual(outbox.map((m) => m.subject), ['Dos', 'Uno']);
    assert.equal(outbox[0]?.id, 'mail-2');
    assert.equal(lines.length, 2);
  });

  it('el programador ejecuta los recordatorios periódicamente y se puede detener', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    try {
      const reporter = new RecordingReporter();
      let runs = 0;
      const scheduler = new ReminderScheduler({
        job: {
          async execute() {
            runs += 1;
            if (runs === 2) throw new Error('falla temporal');
            return { sent: 0, skipped: 0, failed: 0 };
          },
        },
        errors: reporter,
        intervalMs: 60_000,
      });

      scheduler.start();
      scheduler.start(); // idempotente: no crea un segundo intervalo
      mock.timers.tick(60_000);
      mock.timers.tick(60_000);
      await new Promise((resolve) => setImmediate(resolve));
      scheduler.stop();
      mock.timers.tick(60_000);

      assert.equal(runs, 2);
      assert.equal(reporter.reports.length, 1);
    } finally {
      mock.timers.reset();
    }
  });
});
