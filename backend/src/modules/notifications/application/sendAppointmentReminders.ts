import type { Clock } from '../../../shared/clock.js';
import type { ErrorReporter } from '../../../shared/eventBus.js';
import { buildReminderEmail } from '../domain/emailTemplates.js';
import type {
  AppointmentFeed,
  ContactDirectory,
  EmailSender,
  PetContact,
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

interface RunLookups {
  contacts: Map<string, Promise<PetContact | null>>;
  vetNames: Map<string, Promise<string | null>>;
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = load();
  cache.set(key, pending);
  return pending;
}

export class SendAppointmentReminders {
  public constructor(private readonly deps: SendAppointmentRemindersDeps) {}

  public async execute(): Promise<ReminderRunResult> {
    const now = this.deps.clock.now();
    const windowEnd = new Date(now.getTime() + this.deps.leadTimeMinutes * 60_000);
    const candidates = await this.deps.feed.findScheduledStartingBetween(now, windowEnd);

    // Caché por corrida: evita consultas N+1 cuando varias citas comparten veterinario o mascota.
    const lookups: RunLookups = { contacts: new Map(), vetNames: new Map() };
    const result: ReminderRunResult = { sent: 0, skipped: 0, failed: 0 };
    for (const candidate of candidates) {
      const outcome = await this.remind(candidate, now, lookups);
      result[outcome] += 1;
    }
    return result;
  }

  /** Un fallo en una cita no detiene el resto: se reporta y se reintenta en la siguiente corrida. */
  private async remind(candidate: ReminderCandidate, now: Date, lookups: RunLookups): Promise<Outcome> {
    try {
      if (await this.deps.sentReminders.wasSent(candidate.appointmentId)) {
        return 'skipped';
      }
      const contact = await memo(lookups.contacts, candidate.petId, () =>
        this.deps.contacts.getContactForPet(candidate.petId),
      );
      if (!contact) {
        throw new Error(`Cita ${candidate.appointmentId} sin contacto para la mascota ${candidate.petId}`);
      }
      const vetName = await memo(lookups.vetNames, candidate.vetId, () => this.deps.vetNames.getVetName(candidate.vetId));
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
