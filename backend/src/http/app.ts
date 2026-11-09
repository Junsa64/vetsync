import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Container } from '../container.js';
import { createAppointmentRoutes } from '../modules/appointments/infrastructure/http/appointmentRoutes.js';
import { createNotificationRoutes } from '../modules/notifications/infrastructure/http/notificationRoutes.js';
import { createOwnerRoutes, createPetRoutes } from '../modules/patients/infrastructure/http/patientRoutes.js';
import { createVetRoutes } from '../modules/vets/infrastructure/http/vetRoutes.js';
import { createErrorHandler } from './errorHandler.js';

/** Capa HTTP delgada: solo traduce HTTP ↔ casos de uso. Toda la lógica vive en los módulos. */
export function createApp(container: Container): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: container.clock.now().toISOString() });
  });

  app.use('/api/owners', createOwnerRoutes(container.patients));
  app.use('/api/pets', createPetRoutes(container.patients));
  app.use('/api/vets', createVetRoutes(container.vets));
  app.use('/api/appointments', createAppointmentRoutes(container.appointments));
  app.use('/api/notifications', createNotificationRoutes(container.notifications));

  app.use('/api', (_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.' } });
  });
  app.use(createErrorHandler(container.errors));

  return app;
}
