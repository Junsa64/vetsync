import type { Appointment } from '../domain/appointment.js';
import type { AppointmentFilter, AppointmentRepository } from '../application/ports.js';

export class InMemoryAppointmentRepository implements AppointmentRepository {
  public async save(_appointment: Appointment): Promise<void> {
    throw new Error('No implementado (fase roja de TDD)');
  }
  public async findById(_id: string): Promise<Appointment | null> {
    throw new Error('No implementado (fase roja de TDD)');
  }
  public async findActiveOverlappingForVet(_vetId: string, _start: Date, _end: Date): Promise<Appointment[]> {
    throw new Error('No implementado (fase roja de TDD)');
  }
  public async findActiveOverlappingForPet(_petId: string, _start: Date, _end: Date): Promise<Appointment[]> {
    throw new Error('No implementado (fase roja de TDD)');
  }
  public async findScheduledStartingBetween(_from: Date, _to: Date): Promise<Appointment[]> {
    throw new Error('No implementado (fase roja de TDD)');
  }
  public async list(_filter: AppointmentFilter): Promise<Appointment[]> {
    throw new Error('No implementado (fase roja de TDD)');
  }
}
