import { buildConfirmationEmail } from '../domain/emailTemplates.js';
import type { ContactDirectory, EmailSender, ScheduledAppointmentNotice, VetNames } from './ports.js';

export interface SendAppointmentConfirmationDeps {
  contacts: ContactDirectory;
  vetNames: VetNames;
  mailer: EmailSender;
  timeZone: string;
}

/** Reacciona al evento `appointment.scheduled` publicado por el módulo de citas. */
export class SendAppointmentConfirmation {
  public constructor(private readonly deps: SendAppointmentConfirmationDeps) {}

  public async handle(notice: ScheduledAppointmentNotice): Promise<void> {
    const contact = await this.deps.contacts.getContactForPet(notice.petId);
    if (!contact) {
      throw new Error(`Cita ${notice.appointmentId} sin contacto para la mascota ${notice.petId}`);
    }
    const vetName = await this.deps.vetNames.getVetName(notice.vetId);
    await this.deps.mailer.send(
      buildConfirmationEmail({
        appointmentId: notice.appointmentId,
        contact,
        vetName,
        startsAt: new Date(notice.startsAt),
        meetingUrl: notice.meetingUrl,
        timeZone: this.deps.timeZone,
      }),
    );
  }
}
