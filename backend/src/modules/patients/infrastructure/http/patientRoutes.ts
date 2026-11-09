import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AddMedicalRecord } from '../../application/addMedicalRecord.js';
import { parseAddMedicalRecord, parseRegisterOwner, parseRegisterPet } from '../../application/dto.js';
import type { PatientQueries } from '../../application/patientQueries.js';
import type { RegisterOwner } from '../../application/registerOwner.js';
import type { RegisterPet } from '../../application/registerPet.js';
import { optionalText } from '../../../../shared/validation.js';

export interface PatientRouteDeps {
  registerOwner: RegisterOwner;
  registerPet: RegisterPet;
  addMedicalRecord: AddMedicalRecord;
  queries: PatientQueries;
}

export function createOwnerRoutes(deps: PatientRouteDeps): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.queries.listOwners());
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await deps.registerOwner.execute(parseRegisterOwner(req.body)));
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}

export function createPetRoutes(deps: PatientRouteDeps): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = optionalText(req.query.ownerId, 'ownerId', 36);
      res.json(await deps.queries.listPets(ownerId ? { ownerId } : {}));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await deps.registerPet.execute(parseRegisterPet(req.body)));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/:petId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await deps.queries.getPetProfile(String(req.params.petId)));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/:petId/medical-records', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await deps.addMedicalRecord.execute(parseAddMedicalRecord(req.body), String(req.params.petId));
      res.status(201).json(record);
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
