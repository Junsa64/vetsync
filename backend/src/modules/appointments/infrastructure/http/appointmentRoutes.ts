import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppointmentQueries } from '../../application/appointmentQueries.js';
import type { CancelAppointment } from '../../application/cancelAppointment.js';
import { parseAppointmentFilter, parseScheduleAppointment } from '../../application/dto.js';
import type { ScheduleAppointment } from '../../application/scheduleAppointment.js';

export interface AppointmentRouteDeps {
  schedule: ScheduleAppointment;
  cancel: CancelAppointment;
  queries: AppointmentQueries;
}

export function createAppointmentRoutes(deps: AppointmentRouteDeps): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.queries.list(parseAppointmentFilter(req.query)));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await deps.schedule.execute(parseScheduleAppointment(req.body)));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.patch('/:appointmentId/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.cancel.execute(String(req.params.appointmentId)));
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
