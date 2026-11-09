import type { MeetingRoomProvider } from '../application/ports.js';

/** Telemedicina simulada: genera un enlace de sala determinista por cita. */
export class SimulatedMeetingRoomProvider implements MeetingRoomProvider {
  public constructor(private readonly baseUrl: string) {}

  public async createRoomUrl(appointmentId: string): Promise<string> {
    return `${this.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(appointmentId)}`;
  }
}
