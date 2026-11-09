import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterVet } from '../../src/modules/vets/application/registerVet.js';
import { parseRegisterVet } from '../../src/modules/vets/application/dto.js';
import { InMemoryVetRepository } from '../../src/modules/vets/infrastructure/inMemoryVetRepository.js';
import { createVetsPublicApi } from '../../src/modules/vets/public.js';
import { ConflictError, ValidationError } from '../../src/shared/errors.js';
import { FixedClock, SequentialIdGenerator, at } from '../support/fakes.js';

function createSut() {
  const vets = new InMemoryVetRepository();
  const registerVet = new RegisterVet({ vets, clock: new FixedClock(at('2026-11-10T15:00:00Z')), ids: new SequentialIdGenerator('vet') });
  return { vets, registerVet, api: createVetsPublicApi({ vets }) };
}

describe('Veterinarios', () => {
  it('registra un veterinario y lo expone por la API pública', async () => {
    const { registerVet, api, vets } = createSut();

    const vet = await registerVet.execute(
      parseRegisterVet({ fullName: 'Dra. Ana López', email: 'ana@vetsync.mx', specialty: 'Medicina general' }),
    );

    assert.equal(await api.vetExists(vet.id), true);
    assert.equal(await api.vetExists('nope'), false);
    assert.equal(await api.getVetName(vet.id), 'Dra. Ana López');
    assert.equal(await api.getVetName('nope'), null);
    assert.equal((await vets.list()).length, 1);
  });

  it('rechaza correos duplicados y campos vacíos', async () => {
    const { registerVet } = createSut();
    await registerVet.execute(parseRegisterVet({ fullName: 'Ana', email: 'ana@vetsync.mx', specialty: 'General' }));

    await assert.rejects(
      registerVet.execute(parseRegisterVet({ fullName: 'Otra', email: 'ANA@vetsync.mx', specialty: 'General' })),
      (error: unknown) => error instanceof ConflictError && error.code === 'VET_EMAIL_TAKEN',
    );
    assert.throws(
      () => parseRegisterVet({ fullName: 'Ana', email: 'ana@vetsync.mx' }),
      (error: unknown) => error instanceof ValidationError && error.code === 'REQUIRED_FIELD',
    );
  });
});
