import type { Clock } from '../../../shared/clock.js';
import type { ErrorReporter } from '../../../shared/eventBus.js';
import { buildReminderEmail } from '../domain/emailTemplates.js';
import type {
  AppointmentFeed,
  ContactDirectory,
  EmailSender,
  ReminderCandidate,
  SentReminderRepository,
  VetNames,
} from './ports.js';

export interface ReminderRunResult {
  sent: number;
  skipped: number;
  failed: number;
}

export interface SendAppointmentRemindersDeps {
  feed: AppointmentFeed;
  contacts: ContactDirectory;
  vetNames: VetNames;
  mailer: EmailSender;
  sentReminders: SentReminderRepository;
  clock: Clock;
  errors: ErrorReporter;
  /** Con cuánta anticipación se avisa (por defecto 24 h). */
  leadTimeMinutes: number;
  timeZone: string;
}

type Outcome = keyof ReminderRunResult;

export class SendAppointmentReminders {
  public constructor(private readonly deps: SendAppointmentRemindersDeps) {}

  public async execute(): Promise<ReminderRunResult> {
    const now = this.deps.clock.now();
    const windowEnd = new Date(now.getTime() + this.deps.leadTimeMinutes * 60_000);
    const candidates = await this.deps.feed.findScheduledStartingBetween(now, windowEnd);

    const result: ReminderRunResult = { sent: 0, skipped: 0, failed: 0 };
    for (const candidate of candidates) {
      const outcome = await this.remind(candidate, now);
      result[outcome] += 1;
    }
    return result;
  }

  /** Un fallo en una cita no detiene el resto: se reporta y se reintenta en la siguiente corrida. */
  private async remind(candidate: ReminderCandidate, now: Date): Promise<Outcome> {
    try {
      if (await this.deps.sentReminders.wasSent(candidate.appointmentId)) {
        return 'skipped';
      }
      const contact = await this.deps.contacts.getContactForPet(candidate.petId);
      if (!contact) {
        throw new Error(`Cita ${candidate.appointmentId} sin contacto para la mascota ${candidate.petId}`);
      }
      const vetName = await this.deps.vetNames.getVetName(candidate.vetId);
      await this.deps.mailer.send(
        buildReminderEmail({
          appointmentId: candidate.appointmentId,
          contact,
          vetName,
          startsAt: candidate.startsAt,
          meetingUrl: candidate.meetingUrl,
          timeZone: this.deps.timeZone,
        }),
      );
      await this.deps.sentReminders.markSent(candidate.appointmentId, now);
      return 'sent';
    } catch (error: unknown) {
      this.deps.errors.report('reminders', error);
      return 'failed';
    }
  }
}
