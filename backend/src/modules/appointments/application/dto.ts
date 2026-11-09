import {
  asRecord,
  optionalDate,
  optionalText,
  requireDate,
  requireInteger,
  requireOneOf,
  requireText,
} from '../../../shared/validation.js';
import { APPOINTMENT_MODALITIES } from '../domain/appointment.js';
import type { AppointmentFilter } from './ports.js';
import type { ScheduleAppointmentCommand } from './scheduleAppointment.js';

export function parseScheduleAppointment(body: unknown): ScheduleAppointmentCommand {
  const input = asRecord(body);
  return {
    petId: requireText(input.petId, 'petId', 36),
    vetId: requireText(input.vetId, 'vetId', 36),
    startsAt: requireDate(input.startsAt, 'startsAt'),
    durationMinutes: requireInteger(input.durationMinutes, 'durationMinutes'),
    modality: requireOneOf(input.modality, 'modality', APPOINTMENT_MODALITIES),
    reason: requireText(input.reason, 'reason', 255),
  };
}

/** Los filtros llegan como query string; todos son opcionales. */
export function parseAppointmentFilter(query: unknown): AppointmentFilter {
  const input = query === undefined || query === null ? {} : asRecord(query);
  const filter: AppointmentFilter = {};
  const vetId = optionalText(input.vetId, 'vetId', 36);
  const petId = optionalText(input.petId, 'petId', 36);
  const from = optionalDate(input.from, 'from');
  const to = optionalDate(input.to, 'to');
  if (vetId) filter.vetId = vetId;
  if (petId) filter.petId = petId;
  if (from) filter.from = from;
  if (to) filter.to = to;
  return filter;
}
