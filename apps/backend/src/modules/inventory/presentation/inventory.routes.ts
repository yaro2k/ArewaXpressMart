import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import type { InventoryService } from '../application/InventoryService.js';
import { inventoryAdjustmentSchema } from './inventory.schemas.js';
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
export function createInventoryRouter(authService: AuthService, inventoryService: InventoryService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.get('/', asyncRoute(async (req, res) => { res.json({ data: await inventoryService.list(req.principal!.userId) }); }));
  router.post('/adjustments', asyncRoute(async (req, res) => { res.status(201).json({ data: await inventoryService.adjust(req.principal!.userId, inventoryAdjustmentSchema.parse(req.body)) }); }));
  return router;
}
