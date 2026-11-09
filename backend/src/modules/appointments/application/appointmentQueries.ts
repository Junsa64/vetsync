import type { Appointment } from '../domain/appointment.js';
import type { AppointmentFilter, AppointmentRepository } from './ports.js';

export class AppointmentQueries {
  public constructor(private readonly deps: { repository: AppointmentRepository }) {}

  public list(filter: AppointmentFilter): Promise<Appointment[]> {
    return this.deps.repository.list(filter);
  }
}
