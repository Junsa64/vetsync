export interface Owner {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly createdAt: Date;
}

export interface Pet {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly species: string;
  readonly breed: string | null;
  readonly birthDate: Date | null;
  readonly createdAt: Date;
}

/** Registro clínico inmutable: un diagnóstico no se edita, se agrega uno nuevo. */
export interface MedicalRecord {
  readonly id: string;
  readonly petId: string;
  readonly vetId: string | null;
  readonly recordedAt: Date;
  readonly diagnosis: string;
  readonly treatment: string | null;
  readonly notes: string | null;
}
