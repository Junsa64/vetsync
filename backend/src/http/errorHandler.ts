import type { NextFunction, Request, Response } from 'express';
import { ConflictError, DomainError, NotFoundError, ValidationError } from '../shared/errors.js';
import type { ErrorReporter } from '../shared/eventBus.js';

export interface ErrorBody {
  error: { code: string; message: string };
}

function statusFor(error: DomainError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  return 400;
}

/** Errores que lanza express.json() (body-parser) traen `type` y `status`. */
function bodyParserFailure(error: unknown): { status: number; code: string; message: string } | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return null;
  }
  if (error.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido.' };
  }
  if (error.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la petición es demasiado grande.' };
  }
  return null;
}

/** Middleware central (AGENTS.md §5): traduce errores a HTTP sin exponer el stack. */
export function createErrorHandler(reporter: ErrorReporter) {
  return function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (error instanceof DomainError) {
      res.status(statusFor(error)).json({ error: { code: error.code, message: error.message } } satisfies ErrorBody);
      return;
    }
    const parserFailure = bodyParserFailure(error);
    if (parserFailure) {
      res.status(parserFailure.status).json({ error: { code: parserFailure.code, message: parserFailure.message } });
      return;
    }
    reporter.report('http', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } } satisfies ErrorBody);
  };
}
