import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterOwner } from '../../src/modules/patients/application/registerOwner.js';
import { RegisterPet } from '../../src/modules/patients/application/registerPet.js';
import { AddMedicalRecord } from '../../src/modules/patients/application/addMedicalRecord.js';
import { PatientQueries } from '../../src/modules/patients/application/patientQueries.js';
import {
  parseAddMedicalRecord,
  parseRegisterOwner,
  parseRegisterPet,
} from '../../src/modules/patients/application/dto.js';
import {
  InMemoryMedicalRecordRepository,
  InMemoryOwnerRepository,
  InMemoryPetRepository,
} from '../../src/modules/patients/infrastructure/inMemoryPatientRepositories.js';
import { createPatientsPublicApi } from '../../src/modules/patients/public.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import { FixedClock, SequentialIdGenerator, at } from '../support/fakes.js';

const NOW = at('2026-11-10T15:00:00.000Z');

function createSut() {
  const owners = new InMemoryOwnerRepository();
  const pets = new InMemoryPetRepository();
  const records = new InMemoryMedicalRecordRepository();
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator('p');
  return {
    owners,
    pets,
    records,
    clock,
    registerOwner: new RegisterOwner({ owners, clock, ids }),
    registerPet: new RegisterPet({ owners, pets, clock, ids }),
    addRecord: new AddMedicalRecord({ pets, records, clock, ids }),
    queries: new PatientQueries({ owners, pets, records }),
  };
}

describe('Registro de dueños', () => {
  it('registra un dueño y normaliza el correo a minúsculas', async () => {
    const { registerOwner } = createSut();

    const owner = await registerOwner.execute(
      parseRegisterOwner({ fullName: '  Julian Espinosa ', email: 'Julian@Correo.MX', phone: '6421234567' }),
    );

    assert.equal(owner.fullName, 'Julian Espinosa');
    assert.equal(owner.email, 'julian@correo.mx');
    assert.equal(owner.createdAt.toISOString(), NOW.toISOString());
  });

  it('rechaza un correo ya registrado', async () => {
    const { registerOwner } = createSut();
    await registerOwner.execute(parseRegisterOwner({ fullName: 'Ana', email: 'ana@correo.mx' }));

    await assert.rejects(
      registerOwner.execute(parseRegisterOwner({ fullName: 'Otra Ana', email: 'ANA@correo.mx' })),
      (error: unknown) => error instanceof ConflictError && error.code === 'OWNER_EMAIL_TAKEN',
    );
  });

  it('valida la entrada en el borde: correo inválido y nombre vacío', () => {
    assert.throws(
      () => parseRegisterOwner({ fullName: 'Ana', email: 'no-es-correo' }),
      (error: unknown) => error instanceof ValidationError && error.code === 'INVALID_EMAIL',
    );
    assert.throws(
      () => parseRegisterOwner({ fullName: '   ', email: 'a@b.mx' }),
      (error: unknown) => error instanceof ValidationError && error.code === 'REQUIRED_FIELD',
    );
    assert.throws(
      () => parseRegisterOwner(null),
      (error: unknown) => error instanceof ValidationError && error.code === 'INVALID_BODY',
    );
  });
});

describe('Registro de mascotas', () => {
  it('registra una mascota de un dueño existente', async () => {
    const { registerOwner, registerPet } = createSut();
    const owner = await registerOwner.execute(parseRegisterOwner({ fullName: 'Ana', email: 'ana@correo.mx' }));

    const pet = await registerPet.execute(
      parseRegisterPet({ ownerId: owner.id, name: 'Firulais', species: 'Perro', breed: 'Mestizo', birthDate: '2020-05-01' }),
    );

    assert.equal(pet.ownerId, owner.id);
    assert.equal(pet.birthDate?.toISOString().slice(0, 10), '2020-05-01');
  });

  it('rechaza una mascota cuyo dueño no existe', async () => {
    const { registerPet } = createSut();

    await assert.rejects(
      registerPet.execute(parseRegisterPet({ ownerId: 'nadie', name: 'Firulais', species: 'Perro' })),
      (error: unknown) => error instanceof NotFoundError && error.code === 'OWNER_NOT_FOUND',
    );
  });

  it('rechaza una fecha de nacimiento en el futuro', async () => {
    const { registerOwner, registerPet } = createSut();
    const owner = await registerOwner.execute(parseRegisterOwner({ fullName: 'Ana', email: 'ana@correo.mx' }));

    await assert.rejects(
      registerPet.execute(
        parseRegisterPet({ ownerId: owner.id, name: 'Futuro', species: 'Gato', birthDate: '2027-01-01' }),
      ),
      (error: unknown) => error instanceof ValidationError && error.code === 'INVALID_BIRTH_DATE',
    );
  });
});

describe('Historial médico', () => {
  async function petFixture() {
    const sut = createSut();
    const owner = await sut.registerOwner.execute(parseRegisterOwner({ fullName: 'Ana', email: 'ana@correo.mx' }));
    const pet = await sut.registerPet.execute(parseRegisterPet({ ownerId: owner.id, name: 'Michi', species: 'Gato' }));
    return { ...sut, owner, pet };
  }

  it('agrega registros y devuelve el historial del más reciente al más antiguo', async () => {
    const { addRecord, queries, pet, clock } = await petFixture();
    await addRecord.execute(parseAddMedicalRecord({ diagnosis: 'Otitis', treatment: 'Gotas 7 días' }), pet.id);
    clock.advanceMinutes(60 * 24);
    await addRecord.execute(parseAddMedicalRecord({ diagnosis: 'Revisión: otitis resuelta' }), pet.id);

    const profile = await queries.getPetProfile(pet.id);

    assert.deepEqual(
      profile.history.map((record) => record.diagnosis),
      ['Revisión: otitis resuelta', 'Otitis'],
    );
    assert.equal(profile.owner.email, 'ana@correo.mx');
  });

  it('rechaza un registro para una mascota inexistente', async () => {
    const { addRecord } = await petFixture();

    await assert.rejects(
      addRecord.execute(parseAddMedicalRecord({ diagnosis: 'Algo' }), 'pet-fantasma'),
      (error: unknown) => error instanceof NotFoundError && error.code === 'PET_NOT_FOUND',
    );
  });

  it('no permite registrar consultas con fecha futura', async () => {
    const { addRecord, pet } = await petFixture();

    await assert.rejects(
      addRecord.execute(parseAddMedicalRecord({ diagnosis: 'Algo', recordedAt: '2026-12-01T10:00:00Z' }), pet.id),
      (error: unknown) => error instanceof ValidationError && error.code === 'RECORD_IN_FUTURE',
    );
  });

  it('getPetProfile lanza PET_NOT_FOUND si la mascota no existe', async () => {
    const { queries } = await petFixture();

    await assert.rejects(
      queries.getPetProfile('nope'),
      (error: unknown) => error instanceof NotFoundError && error.code === 'PET_NOT_FOUND',
    );
  });
});

describe('API pública del módulo de pacientes', () => {
  it('expone solo existencia de mascota y contacto del dueño', async () => {
    const { registerOwner, registerPet, owners, pets, queries } = createSut();
    const owner = await registerOwner.execute(parseRegisterOwner({ fullName: 'Ana', email: 'ana@correo.mx' }));
    const pet = await registerPet.execute(parseRegisterPet({ ownerId: owner.id, name: 'Michi', species: 'Gato' }));
    const api = createPatientsPublicApi({ owners, pets });

    assert.equal(await api.petExists(pet.id), true);
    assert.equal(await api.petExists('nope'), false);
    assert.deepEqual(await api.getContactForPet(pet.id), {
      ownerName: 'Ana',
      ownerEmail: 'ana@correo.mx',
      petName: 'Michi',
    });
    assert.equal(await api.getContactForPet('nope'), null);
    assert.equal((await queries.listOwners()).length, 1);
    assert.equal((await queries.listPets({ ownerId: owner.id })).length, 1);
    assert.equal((await queries.listPets({})).length, 1);
  });
});
