import type {
  Appointment,
  MedicalRecord,
  Owner,
  Pet,
  PetProfile,
  ReminderRunResult,
  SentEmail,
  Vet,
} from './types';

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  public constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readError(body: unknown): { code: string; message: string } {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      return { code: String(error.code), message: String(error.message) };
    }
  }
  return { code: 'UNKNOWN', message: 'Respuesta inesperada del servidor.' };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No hay conexión con el servidor de VetSync.');
  }
  // Una respuesta sin cuerpo JSON (p. ej. un 502 del proxy) se trata como cuerpo vacío;
  // el error se reporta igual abajo con el status HTTP.
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, message } = readError(body);
    throw new ApiError(response.status, code, message);
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  listOwners: () => request<Owner[]>('/owners'),
  createOwner: (data: { fullName: string; email: string; phone?: string }) => post<Owner>('/owners', data),
  listPets: () => request<Pet[]>('/pets'),
  createPet: (data: { ownerId: string; name: string; species: string; breed?: string; birthDate?: string }) =>
    post<Pet>('/pets', data),
  getPetProfile: (petId: string) => request<PetProfile>(`/pets/${encodeURIComponent(petId)}`),
  addMedicalRecord: (petId: string, data: { diagnosis: string; treatment?: string; notes?: string; vetId?: string }) =>
    post<MedicalRecord>(`/pets/${encodeURIComponent(petId)}/medical-records`, data),
  listVets: () => request<Vet[]>('/vets'),
  listAppointments: (from: Date, to: Date) =>
    request<Appointment[]>(
      `/appointments?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString()}`,
    ),
  scheduleAppointment: (data: {
    petId: string;
    vetId: string;
    startsAt: string;
    durationMinutes: number;
    modality: string;
    reason: string;
  }) => post<Appointment>('/appointments', data),
  cancelAppointment: (id: string) =>
    request<Appointment>(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' }),
  listOutbox: () => request<SentEmail[]>('/notifications/outbox'),
  runReminders: () => post<ReminderRunResult>('/notifications/reminders/run'),
};
