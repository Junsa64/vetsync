import type { MedicalRecord, Owner, Pet } from '../domain/patients.js';
import type { MedicalRecordRepository, OwnerRepository, PetFilter, PetRepository } from '../application/ports.js';

export class InMemoryOwnerRepository implements OwnerRepository {
  private readonly items = new Map<string, Owner>();

  public async save(owner: Owner): Promise<void> {
    this.items.set(owner.id, { ...owner });
  }

  public async findById(id: string): Promise<Owner | null> {
    const owner = this.items.get(id);
    return owner ? { ...owner } : null;
  }

  public async findByEmail(email: string): Promise<Owner | null> {
    const normalized = email.toLowerCase();
    const owner = [...this.items.values()].find((item) => item.email === normalized);
    return owner ? { ...owner } : null;
  }

  public async list(): Promise<Owner[]> {
    return [...this.items.values()]
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      .map((owner) => ({ ...owner }));
  }
}

export class InMemoryPetRepository implements PetRepository {
  private readonly items = new Map<string, Pet>();

  public async save(pet: Pet): Promise<void> {
    this.items.set(pet.id, { ...pet });
  }

  public async findById(id: string): Promise<Pet | null> {
    const pet = this.items.get(id);
    return pet ? { ...pet } : null;
  }

  public async list(filter: PetFilter): Promise<Pet[]> {
    return [...this.items.values()]
      .filter((pet) => filter.ownerId === undefined || pet.ownerId === filter.ownerId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((pet) => ({ ...pet }));
  }
}

export class InMemoryMedicalRecordRepository implements MedicalRecordRepository {
  private readonly items: MedicalRecord[] = [];

  public async add(record: MedicalRecord): Promise<void> {
    this.items.push({ ...record });
  }

  public async listByPet(petId: string): Promise<MedicalRecord[]> {
    return this.items
      .filter((record) => record.petId === petId)
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
      .map((record) => ({ ...record }));
  }
}
