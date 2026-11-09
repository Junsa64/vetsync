import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/http/app.js';
import { createErrorHandler } from '../../src/http/errorHandler.js';
import { seed } from '../../src/seed.js';
import type { ErrorReporter } from '../../src/shared/eventBus.js';
import { FixedClock, SequentialIdGenerator, at } from '../support/fakes.js';

class SilentReporter implements ErrorReporter {
  public readonly reports: string[] = [];
  public report(context: string): void {
    this.reports.push(context);
  }
}

interface JsonResponse {
  status: number;
  body: unknown;
}

let server: Server;
let baseUrl = '';

async function call(method: string, path: string, body?: unknown, rawBody?: string): Promise<JsonResponse> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${baseUrl}${path}`, init);
  return { status: response.status, body: await response.json() };
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function errorCode(response: JsonResponse): unknown {
  return field(field(response.body, 'error'), 'code');
}

describe('API HTTP de VetSync (integración)', () => {
  before(async () => {
    const container = buildContainer({
      clock: new FixedClock(at('2026-11-10T15:00:00.000Z')),
      ids: new SequentialIdGenerator('id'),
      errors: new SilentReporter(),
      log: () => undefined,
      timeZone: 'America/Hermosillo',
    });
    server = createApp(container).listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
  });

  it('GET /api/health responde ok', async () => {
    const response = await call('GET', '/api/health');
    assert.equal(response.status, 200);
    assert.equal(field(response.body, 'status'), 'ok');
  });

  it('flujo completo: registrar, agendar, chocar, confirmar, recordar y cancelar', async () => {
    const vet = await call('POST', '/api/vets', { fullName: 'Dra. Ana', email: 'ana@vetsync.mx', specialty: 'General' });
    const owner = await call('POST', '/api/owners', { fullName: 'Julian', email: 'julian@correo.mx' });
    const pet = await call('POST', '/api/pets', { ownerId: field(owner.body, 'id'), name: 'Firulais', species: 'Perro' });
    const otherPet = await call('POST', '/api/pets', { ownerId: field(owner.body, 'id'), name: 'Michi', species: 'Gato' });
    assert.deepEqual([vet.status, owner.status, pet.status, otherPet.status], [201, 201, 201, 201]);

    const appointmentBody = {
      petId: field(pet.body, 'id'),
      vetId: field(vet.body, 'id'),
      startsAt: '2026-11-10T18:00:00.000Z',
      durationMinutes: 30,
      modality: 'TELEMEDICINE',
      reason: 'Seguimiento',
    };
    const created = await call('POST', '/api/appointments', appointmentBody);
    assert.equal(created.status, 201);
    assert.match(String(field(created.body, 'meetingUrl')), /^https:\/\/meet\.vetsync\.local\/sala\//);

    const clash = await call('POST', '/api/appointments', { ...appointmentBody, petId: field(otherPet.body, 'id') });
    assert.equal(clash.status, 409);
    assert.equal(errorCode(clash), 'VET_BUSY');

    const list = await call('GET', `/api/appointments?vetId=${String(field(vet.body, 'id'))}`);
    assert.equal(Array.isArray(list.body) ? list.body.length : -1, 1);

    const reminders = await call('POST', '/api/notifications/reminders/run');
    assert.deepEqual(reminders.body, { sent: 1, skipped: 0, failed: 0 });

    const outbox = await call('GET', '/api/notifications/outbox');
    const kinds = Array.isArray(outbox.body) ? outbox.body.map((m: unknown) => field(m, 'kind')).sort() : [];
    assert.deepEqual(kinds, ['CONFIRMATION', 'REMINDER']);

    const cancelled = await call('PATCH', `/api/appointments/${String(field(created.body, 'id'))}/cancel`);
    assert.equal(field(cancelled.body, 'status'), 'CANCELLED');
  });

  it('historial médico vía HTTP y perfil de la mascota', async () => {
    const owner = await call('POST', '/api/owners', { fullName: 'María', email: 'maria@correo.mx' });
    const pet = await call('POST', '/api/pets', { ownerId: field(owner.body, 'id'), name: 'Rocky', species: 'Perro' });
    const petId = String(field(pet.body, 'id'));

    const record = await call('POST', `/api/pets/${petId}/medical-records`, { diagnosis: 'Otitis', treatment: 'Gotas' });
    const profile = await call('GET', `/api/pets/${petId}`);
    const pets = await call('GET', `/api/pets?ownerId=${String(field(owner.body, 'id'))}`);
    const owners = await call('GET', '/api/owners');
    const vets = await call('GET', '/api/vets');

    assert.equal(record.status, 201);
    assert.equal(Array.isArray(field(profile.body, 'history')) ? (field(profile.body, 'history') as unknown[]).length : -1, 1);
    assert.equal(Array.isArray(pets.body) ? pets.body.length : -1, 1);
    assert.equal(owners.status, 200);
    assert.equal(vets.status, 200);
  });

  it('traduce errores a códigos HTTP: 400 validación, 404 inexistente, 400 JSON inválido, 404 ruta', async () => {
    const invalid = await call('POST', '/api/owners', { fullName: 'X', email: 'no-es-correo' });
    const missing = await call('GET', '/api/pets/no-existe');
    const badJson = await call('POST', '/api/owners', undefined, '{"fullName": ');
    const noRoute = await call('GET', '/api/no-existe');

    assert.deepEqual([invalid.status, errorCode(invalid)], [400, 'INVALID_EMAIL']);
    assert.deepEqual([missing.status, errorCode(missing)], [404, 'PET_NOT_FOUND']);
    assert.deepEqual([badJson.status, errorCode(badJson)], [400, 'INVALID_JSON']);
    assert.deepEqual([noRoute.status, errorCode(noRoute)], [404, 'ROUTE_NOT_FOUND']);
  });
});

describe('Middleware de errores', () => {
  function fakeResponse() {
    const captured: { status: number; body: unknown } = { status: 0, body: null };
    const res = {
      status(code: number) {
        captured.status = code;
        return res;
      },
      json(body: unknown) {
        captured.body = body;
        return res;
      },
    };
    return { res: res as unknown as Response, captured };
  }

  it('un error inesperado responde 500 genérico, sin stack, y se reporta', () => {
    const reporter = new SilentReporter();
    const { res, captured } = fakeResponse();

    createErrorHandler(reporter)(new Error('detalle interno secreto'), {} as Request, res, (() => undefined) as NextFunction);

    assert.equal(captured.status, 500);
    assert.doesNotMatch(JSON.stringify(captured.body), /secreto|stack/);
    assert.deepEqual(reporter.reports, ['http']);
  });

  it('un cuerpo demasiado grande responde 413', () => {
    const { res, captured } = fakeResponse();

    createErrorHandler(new SilentReporter())({ type: 'entity.too.large' }, {} as Request, res, (() => undefined) as NextFunction);

    assert.equal(captured.status, 413);
  });
});

describe('Datos de demostración', () => {
  it('el seed carga veterinarios, mascotas y citas válidas sin choques', async () => {
    const container = buildContainer({
      clock: new FixedClock(at('2026-11-10T15:07:00.000Z')),
      ids: new SequentialIdGenerator('seed'),
      log: () => undefined,
    });

    await seed(container);

    assert.equal((await container.vets.queries.list()).length, 3);
    assert.equal((await container.patients.queries.listPets({})).length, 3);
    const appointments = await container.appointments.queries.list({});
    assert.equal(appointments.length, 3);
    assert.ok(appointments.every((a) => a.startsAt.getUTCMinutes() % 15 === 0));
    assert.equal((await container.notifications.outbox.list()).length, 3);
  });
});
