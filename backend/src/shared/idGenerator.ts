import { randomUUID } from 'node:crypto';

export interface IdGenerator {
  next(): string;
}

export class UuidGenerator implements IdGenerator {
  public next(): string {
    return randomUUID();
  }
}
