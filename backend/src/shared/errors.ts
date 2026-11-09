/**
 * Errores de negocio. Cada uno lleva un `code` estable que el frontend y las
 * pruebas pueden usar sin depender del texto del mensaje.
 */
export abstract class DomainError extends Error {
  public readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  public constructor(code: string, message: string) {
    super(code, message);
  }
}

export class NotFoundError extends DomainError {
  public constructor(code: string, message: string) {
    super(code, message);
  }
}

export class ConflictError extends DomainError {
  public constructor(code: string, message: string) {
    super(code, message);
  }
}
