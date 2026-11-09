import { NotFoundError } from '../../../shared/errors.js';
import { cancel, type Appointment } from '../domain/appointment.js';
import type { AppointmentRepository } from './ports.js';

export class CancelAppointment {
  public constructor(private readonly deps: { repository: AppointmentRepository }) {}

  public async execute(appointmentId: string): Promise<Appointment> {
    const appointment = await this.deps.repository.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('APPOINTMENT_NOT_FOUND', 'La cita no existe.');
    }
    const cancelled = cancel(appointment);
    await this.deps.repository.save(cancelled);
    return cancelled;
  }
}
