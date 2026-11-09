import type { Vet } from '../domain/vet.js';
import type { VetRepository } from './ports.js';

export class VetQueries {
  public constructor(private readonly deps: { vets: VetRepository }) {}

  public list(): Promise<Vet[]> {
    return this.deps.vets.list();
  }
}
