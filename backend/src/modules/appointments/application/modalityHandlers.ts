import type { AppointmentModality } from '../domain/appointment.js';
import type { MeetingRoomProvider } from './ports.js';

export interface ModalityPreparation {
  meetingUrl: string | null;
}

/** Estrategia por modalidad (OCP): una nueva modalidad es un nuevo handler, no un `if` más. */
export interface ModalityHandler {
  prepare(appointmentId: string): Promise<ModalityPreparation>;
}

/** El tipo Record obliga a registrar un handler por cada modalidad declarada. */
export type ModalityHandlers = Record<AppointmentModality, ModalityHandler>;

export class InPersonHandler implements ModalityHandler {
  public async prepare(): Promise<ModalityPreparation> {
    return { meetingUrl: null };
  }
}

export class TelemedicineHandler implements ModalityHandler {
  public constructor(private readonly meetingRooms: MeetingRoomProvider) {}

  public async prepare(appointmentId: string): Promise<ModalityPreparation> {
    return { meetingUrl: await this.meetingRooms.createRoomUrl(appointmentId) };
  }
}

export function createModalityHandlers(meetingRooms: MeetingRoomProvider): ModalityHandlers {
  return {
    IN_PERSON: new InPersonHandler(),
    TELEMEDICINE: new TelemedicineHandler(meetingRooms),
  };
}
