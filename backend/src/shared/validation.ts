import { ValidationError } from './errors.js';

/** Validadores de borde: convierten `unknown` (entrada del usuario) en tipos seguros. */

export function requireText(value: unknown, field: string, maxLength = 255): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('REQUIRED_FIELD', `El campo "${field}" es obligatorio.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError('FIELD_TOO_LONG', `El campo "${field}" excede ${maxLength} caracteres.`);
  }
  return trimmed;
}

export function optionalText(value: unknown, field: string, maxLength = 255): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireText(value, field, maxLength);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(value: unknown, field = 'email'): string {
  const email = requireText(value, field, 160).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('INVALID_EMAIL', `El campo "${field}" no es un correo válido.`);
  }
  return email;
}

export function requireDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new ValidationError('INVALID_DATE', `El campo "${field}" debe ser una fecha ISO 8601.`);
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('INVALID_DATE', `El campo "${field}" debe ser una fecha ISO 8601.`);
  }
  return date;
}

export function optionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireDate(value, field);
}

export function requireInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
    throw new ValidationError('INVALID_NUMBER', `El campo "${field}" debe ser un número entero.`);
  }
  return parsed;
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const match = allowed.find((option) => option === value);
  if (match === undefined) {
    throw new ValidationError(
      'INVALID_OPTION',
      `El campo "${field}" debe ser uno de: ${allowed.join(', ')}.`,
    );
  }
  return match;
}
