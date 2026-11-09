import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeyedMutex } from '../../src/shared/keyedMutex.js';
import { InMemoryEventBus, type ErrorReporter } from '../../src/shared/eventBus.js';
import { at } from '../support/fakes.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('KeyedMutex', () => {
  it('serializa tareas con la misma llave', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`inicio ${name}`);
      await tick();
      log.push(`fin ${name}`);
    };

    await Promise.all([mutex.runExclusive(['vet:1'], task('A')), mutex.runExclusive(['vet:1'], task('B'))]);

    assert.deepEqual(log, ['inicio A', 'fin A', 'inicio B', 'fin B']);
    assert.equal(mutex.pendingKeys, 0, 'no deben quedar llaves retenidas (fuga de memoria)');
  });

  it('permite paralelismo entre llaves distintas', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`inicio ${name}`);
      await tick();
      log.push(`fin ${name}`);
    };

    await Promise.all([mutex.runExclusive(['vet:1'], task('A')), mutex.runExclusive(['vet:2'], task('B'))]);

    assert.deepEqual(log, ['inicio A', 'inicio B', 'fin A', 'fin B']);
  });

  it('libera la llave aunque la tarea falle y no se interbloquea con llaves cruzadas', async () => {
    const mutex = new KeyedMutex();

    await assert.rejects(mutex.runExclusive(['a'], async () => Promise.reject(new Error('falla'))), /falla/);
    const results = await Promise.all([
      mutex.runExclusive(['a', 'b'], async () => 'ab'),
      mutex.runExclusive(['b', 'a'], async () => 'ba'),
    ]);

    assert.deepEqual(results, ['ab', 'ba']);
    assert.equal(mutex.pendingKeys, 0);
  });
});

describe('InMemoryEventBus', () => {
  it('entrega el evento a todos los suscriptores y reporta (sin propagar) los que fallan', async () => {
    const reports: string[] = [];
    const reporter: ErrorReporter = { report: (context) => reports.push(context) };
    const bus = new InMemoryEventBus(reporter);
    const received: string[] = [];
    bus.subscribe<string>('demo', async () => Promise.reject(new Error('suscriptor roto')));
    bus.subscribe<string>('demo', async (event) => {
      received.push(event.payload);
    });

    await bus.publish({ type: 'demo', occurredAt: at('2026-11-10T00:00:00Z'), payload: 'hola' });
    await bus.publish({ type: 'sin-suscriptores', occurredAt: at('2026-11-10T00:00:00Z'), payload: 'nadie' });

    assert.deepEqual(received, ['hola']);
    assert.deepEqual(reports, ['event:demo']);
  });
});
