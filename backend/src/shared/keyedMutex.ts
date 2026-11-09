/**
 * Exclusión mutua por llave (p. ej. "vet:123"). Evita la condición de carrera
 * "revisar y luego guardar" cuando dos solicitudes piden el mismo horario.
 */
export interface KeyedLock {
  runExclusive<T>(keys: readonly string[], task: () => Promise<T>): Promise<T>;
}

export class KeyedMutex implements KeyedLock {
  private readonly tails = new Map<string, Promise<void>>();

  /** Llaves con tareas en curso o en espera (diagnóstico y pruebas de fugas). */
  public get pendingKeys(): number {
    return this.tails.size;
  }

  public async runExclusive<T>(keys: readonly string[], task: () => Promise<T>): Promise<T> {
    // Orden fijo de adquisición: evita interbloqueos cuando dos tareas comparten llaves.
    const ordered = [...new Set(keys)].sort();
    const releases: Array<() => void> = [];
    try {
      for (const key of ordered) {
        releases.push(await this.acquire(key));
      }
      return await task();
    } finally {
      releases.reverse().forEach((release) => release());
    }
  }

  private async acquire(key: string): Promise<() => void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;
    return () => {
      release();
      // Limpieza: si nadie más esperó esta llave, se elimina (sin fugas de memoria).
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    };
  }
}
