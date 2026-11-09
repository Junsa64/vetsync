import type { Clock } from '../../../shared/clock.js';
import type { IdGenerator } from '../../../shared/idGenerator.js';
import type { EmailMessage, EmailOutbox, EmailSender, SentEmail } from '../application/ports.js';

export interface SimulatedEmailSenderDeps {
  clock: Clock;
  ids: IdGenerator;
  log: (line: string) => void;
}

/**
 * Correo simulado (requerimiento 3): no sale nada a internet. Cada mensaje se
 * guarda en una bandeja consultable y se imprime en consola. Para enviar correo
 * real basta otra clase que implemente `EmailSender` (p. ej. SMTP o SES).
 */
export class SimulatedEmailSender implements EmailSender, EmailOutbox {
  private readonly outbox: SentEmail[] = [];

  public constructor(private readonly deps: SimulatedEmailSenderDeps) {}

  public async send(message: EmailMessage): Promise<void> {
    const sent: SentEmail = { ...message, id: this.deps.ids.next(), sentAt: this.deps.clock.now() };
    this.outbox.push(sent);
    this.deps.log(`[correo simulado] ${sent.kind} → ${sent.to} | ${sent.subject}`);
  }

  public async list(): Promise<SentEmail[]> {
    return [...this.outbox].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()).map((m) => ({ ...m }));
  }
}
