import type { Vet } from '../domain/vet.js';
import type { VetRepository } from '../application/ports.js';

export class InMemoryVetRepository implements VetRepository {
  private readonly items = new Map<string, Vet>();

  public async save(vet: Vet): Promise<void> {
    this.items.set(vet.id, { ...vet });
  }

  public async findById(id: string): Promise<Vet | null> {
    const vet = this.items.get(id);
    return vet ? { ...vet } : null;
  }

  public async findByEmail(email: string): Promise<Vet | null> {
    const normalized = email.toLowerCase();
    const vet = [...this.items.values()].find((item) => item.email === normalized);
    return vet ? { ...vet } : null;
  }

  public async list(): Promise<Vet[]> {
    return [...this.items.values()]
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      .map((vet) => ({ ...vet }));
  }
}
