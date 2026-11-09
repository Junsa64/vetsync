import { overlaps, type Appointment } from '../domain/appointment.js';
import type { AppointmentFilter, AppointmentRepository } from '../application/ports.js';

/** Copia defensiva: nadie fuera del repositorio puede mutar lo almacenado. */
function clone(appointment: Appointment): Appointment {
  return {
    ...appointment,
    startsAt: new Date(appointment.startsAt.getTime()),
    endsAt: new Date(appointment.endsAt.getTime()),
    createdAt: new Date(appointment.createdAt.getTime()),
  };
}

function byStart(a: Appointment, b: Appointment): number {
  return a.startsAt.getTime() - b.startsAt.getTime();
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly items = new Map<string, Appointment>();

  public async save(appointment: Appointment): Promise<void> {
    this.items.set(appointment.id, clone(appointment));
  }

  public async findById(id: string): Promise<Appointment | null> {
    const found = this.items.get(id);
    return found ? clone(found) : null;
  }

  public async findActiveOverlappingForVet(vetId: string, start: Date, end: Date): Promise<Appointment[]> {
    return this.activeWhere((a) => a.vetId === vetId && overlaps(a, start, end));
  }

  public async findActiveOverlappingForPet(petId: string, start: Date, end: Date): Promise<Appointment[]> {
    return this.activeWhere((a) => a.petId === petId && overlaps(a, start, end));
  }

  public async findScheduledStartingBetween(from: Date, to: Date): Promise<Appointment[]> {
    return this.activeWhere(
      (a) => a.startsAt.getTime() >= from.getTime() && a.startsAt.getTime() < to.getTime(),
    );
  }

  public async list(filter: AppointmentFilter): Promise<Appointment[]> {
    return [...this.items.values()]
      .filter((a) => filter.vetId === undefined || a.vetId === filter.vetId)
      .filter((a) => filter.petId === undefined || a.petId === filter.petId)
      .filter((a) => filter.from === undefined || a.startsAt.getTime() >= filter.from.getTime())
      .filter((a) => filter.to === undefined || a.startsAt.getTime() < filter.to.getTime())
      .sort(byStart)
      .map(clone);
  }

  private activeWhere(predicate: (appointment: Appointment) => boolean): Appointment[] {
    return [...this.items.values()]
      .filter((a) => a.status === 'SCHEDULED' && predicate(a))
      .sort(byStart)
      .map(clone);
  }
}
