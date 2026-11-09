import type { Vet } from '../domain/vet.js';

export interface VetRepository {
  save(vet: Vet): Promise<void>;
  findById(id: string): Promise<Vet | null>;
  findByEmail(email: string): Promise<Vet | null>;
  list(): Promise<Vet[]>;
}
