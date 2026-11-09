export interface DomainEvent<TPayload> {
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type EventHandler<TPayload> = (event: DomainEvent<TPayload>) => Promise<void>;

/** Bus de eventos en proceso: permite que los módulos se comuniquen sin importarse. */
export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): void;
}

export interface ErrorReporter {
  report(context: string, error: unknown): void;
}

export class ConsoleErrorReporter implements ErrorReporter {
  public report(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${context}] ${message}`);
  }
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  public constructor(private readonly errorReporter: ErrorReporter) {}

  public subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): void {
    const current = this.handlers.get(type) ?? [];
    current.push(handler as EventHandler<unknown>);
    this.handlers.set(type, current);
  }

  /**
   * Un suscriptor que falla no debe deshacer la operación que publicó el evento
   * (la cita ya quedó agendada aunque el correo de confirmación falle).
   */
  public async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error: unknown) {
        this.errorReporter.report(`event:${event.type}`, error);
      }
    }
  }
}
