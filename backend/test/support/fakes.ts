import type { Clock } from '../../src/shared/clock.js';
import type { IdGenerator } from '../../src/shared/idGenerator.js';
import type { DomainEvent, EventBus, EventHandler } from '../../src/shared/eventBus.js';
import type {
  MeetingRoomProvider,
  PetDirectory,
  VetDirectory,
} from '../../src/modules/appointments/application/ports.js';

/** Reloj congelado: las pruebas nunca dependen de la hora real. */
export class FixedClock implements Clock {
  public constructor(private current: Date) {}

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  public constructor(private readonly prefix = 'id') {}

  public next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}

export class StubPetDirectory implements PetDirectory {
  public constructor(private readonly knownPetIds: Set<string>) {}

  public async exists(petId: string): Promise<boolean> {
    return this.knownPetIds.has(petId);
  }
}

export class StubVetDirectory implements VetDirectory {
  public constructor(private readonly knownVetIds: Set<string>) {}

  public async exists(vetId: string): Promise<boolean> {
    return this.knownVetIds.has(vetId);
  }
}

export class FakeMeetingRoomProvider implements MeetingRoomProvider {
  public async createRoomUrl(appointmentId: string): Promise<string> {
    return `https://meet.test/${appointmentId}`;
  }
}

/** Bus que guarda los eventos publicados para poder afirmarlos. */
export class RecordingEventBus implements EventBus {
  public readonly published: DomainEvent<unknown>[] = [];

  public async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    this.published.push(event as DomainEvent<unknown>);
  }

  public subscribe<TPayload>(_type: string, _handler: EventHandler<TPayload>): void {
    // No se usa en las pruebas que solo verifican publicación.
  }
}

export function at(iso: string): Date {
  return new Date(iso);
}
