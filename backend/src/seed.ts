import type { Container } from './container.js';

const QUARTER_MS = 15 * 60_000;

/** Próximo cuarto de hora + `hoursAhead` horas (las citas van en bloques de 15 min). */
function slot(now: Date, hoursAhead: number): Date {
  const rounded = Math.ceil(now.getTime() / QUARTER_MS) * QUARTER_MS;
  return new Date(rounded + hoursAhead * 3_600_000);
}

/** Datos de demostración creados a través de los casos de uso (respetan todas las reglas). */
export async function seed(container: Container): Promise<void> {
  const { patients, vets, appointments, clock } = container;
  const now = clock.now();

  const ana = await vets.registerVet.execute({ fullName: 'Dra. Ana López', email: 'ana.lopez@vetsync.mx', specialty: 'Medicina general' });
  const luis = await vets.registerVet.execute({ fullName: 'Dr. Luis Valenzuela', email: 'luis.valenzuela@vetsync.mx', specialty: 'Dermatología' });
  await vets.registerVet.execute({ fullName: 'Dra. Sofía Ruiz', email: 'sofia.ruiz@vetsync.mx', specialty: 'Cirugía' });

  const julian = await patients.registerOwner.execute({ fullName: 'Julian Espinosa', email: 'julian@correo.mx', phone: '642 123 4567' });
  const maria = await patients.registerOwner.execute({ fullName: 'María Castro', email: 'maria.castro@correo.mx', phone: null });

  const firulais = await patients.registerPet.execute({ ownerId: julian.id, name: 'Firulais', species: 'Perro', breed: 'Mestizo', birthDate: new Date('2019-03-14') });
  const michi = await patients.registerPet.execute({ ownerId: julian.id, name: 'Michi', species: 'Gato', breed: 'Siamés', birthDate: new Date('2021-08-02') });
  const rocky = await patients.registerPet.execute({ ownerId: maria.id, name: 'Rocky', species: 'Perro', breed: 'Labrador', birthDate: null });

  await patients.addMedicalRecord.execute(
    { diagnosis: 'Vacuna antirrábica anual', treatment: 'Aplicada', notes: null, vetId: ana.id, recordedAt: new Date(now.getTime() - 200 * 86_400_000) },
    firulais.id,
  );
  await patients.addMedicalRecord.execute(
    { diagnosis: 'Dermatitis alérgica', treatment: 'Shampoo medicado 2 semanas', notes: 'Revisar en 1 mes', vetId: luis.id, recordedAt: new Date(now.getTime() - 30 * 86_400_000) },
    firulais.id,
  );

  await appointments.schedule.execute({ petId: firulais.id, vetId: luis.id, startsAt: slot(now, 2), durationMinutes: 30, modality: 'IN_PERSON', reason: 'Revisión de dermatitis' });
  await appointments.schedule.execute({ petId: michi.id, vetId: ana.id, startsAt: slot(now, 20), durationMinutes: 30, modality: 'TELEMEDICINE', reason: 'Seguimiento de apetito' });
  await appointments.schedule.execute({ petId: rocky.id, vetId: ana.id, startsAt: slot(now, 50), durationMinutes: 60, modality: 'IN_PERSON', reason: 'Chequeo general' });
}
