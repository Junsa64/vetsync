import type { SentReminderRepository } from '../application/ports.js';

export class InMemorySentReminderRepository implements SentReminderRepository {
  private readonly sent = new Map<string, Date>();

  public async wasSent(appointmentId: string): Promise<boolean> {
    return this.sent.has(appointmentId);
  }

  public async markSent(appointmentId: string, sentAt: Date): Promise<void> {
    this.sent.set(appointmentId, sentAt);
  }
}
