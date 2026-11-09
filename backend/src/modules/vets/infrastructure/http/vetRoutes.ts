import { Router, type NextFunction, type Request, type Response } from 'express';
import { parseRegisterVet } from '../../application/dto.js';
import type { RegisterVet } from '../../application/registerVet.js';
import type { VetQueries } from '../../application/vetQueries.js';

export function createVetRoutes(deps: { registerVet: RegisterVet; queries: VetQueries }): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.queries.list());
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await deps.registerVet.execute(parseRegisterVet(req.body)));
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
