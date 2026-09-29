import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import type { SellerService } from '../application/SellerService.js';
import { sellerApplicationSchema, sellerProfileUpdateSchema, storeCreateSchema, storeUpdateSchema, warehouseCreateSchema, warehouseUpdateSchema } from './seller.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };

export function createSellerRouter(authService: AuthService, sellerService: SellerService): Router {
  const router = Router();
  router.use(requireAuthentication(authService));
  router.post('/applications', asyncRoute(async (req, res) => { res.status(201).json({ data: await sellerService.apply(req.principal!.userId, sellerApplicationSchema.parse(req.body)) }); }));
  router.get('/profile', asyncRoute(async (req, res) => { res.json({ data: await sellerService.getProfile(req.principal!.userId) }); }));
  router.patch('/profile', asyncRoute(async (req, res) => { res.json({ data: await sellerService.updateProfile(req.principal!.userId, sellerProfileUpdateSchema.parse(req.body)) }); }));
  router.get('/stores', asyncRoute(async (req, res) => { res.json({ data: await sellerService.listStores(req.principal!.userId) }); }));
  router.post('/stores', asyncRoute(async (req, res) => { res.status(201).json({ data: await sellerService.createStore(req.principal!.userId, storeCreateSchema.parse(req.body)) }); }));
  router.patch('/stores/:storeId', asyncRoute(async (req, res) => { res.json({ data: await sellerService.updateStore(req.principal!.userId, requiredParam(req.params.storeId), storeUpdateSchema.parse(req.body)) }); }));
  router.get('/warehouses', asyncRoute(async (req, res) => { res.json({ data: await sellerService.listWarehouses(req.principal!.userId) }); }));
  router.post('/warehouses', asyncRoute(async (req, res) => { res.status(201).json({ data: await sellerService.createWarehouse(req.principal!.userId, warehouseCreateSchema.parse(req.body)) }); }));
  router.patch('/warehouses/:warehouseId', asyncRoute(async (req, res) => { res.json({ data: await sellerService.updateWarehouse(req.principal!.userId, requiredParam(req.params.warehouseId), warehouseUpdateSchema.parse(req.body)) }); }));
  return router;
}

export function createPublicStoreRouter(sellerService: SellerService): Router {
  const router = Router();
  router.get('/:slug', asyncRoute(async (req, res) => { res.json({ data: await sellerService.getPublicStore(requiredParam(req.params.slug)) }); }));
  return router;
}

function requiredParam(value: string | string[] | undefined): string { if (typeof value !== 'string' || value.length === 0) throw new Error('Required route parameter is missing.'); return value; }
