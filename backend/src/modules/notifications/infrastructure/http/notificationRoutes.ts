import { Router, type NextFunction, type Request, type Response } from 'express';
import type { EmailOutbox } from '../../application/ports.js';
import type { SendAppointmentReminders } from '../../application/sendAppointmentReminders.js';

export function createNotificationRoutes(deps: { outbox: EmailOutbox; sendReminders: SendAppointmentReminders }): Router {
  const router = Router();

  router.get('/outbox', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.outbox.list());
    } catch (error: unknown) {
      next(error);
    }
  });

  /** Dispara el barrido de recordatorios a demanda (el programador lo hace cada minuto). */
  router.post('/reminders/run', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.sendReminders.execute());
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
