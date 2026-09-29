import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { CheckoutService } from '../application/CheckoutService.js';
import { addressCreateSchema, addressUpdateSchema, checkoutSchema, idempotencyKeySchema, locationQuerySchema } from './checkout.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || value.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };

export function createAddressRouter(authService: AuthService, checkoutService: CheckoutService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.get('/', asyncRoute(async (req, res) => { res.json({ data: await checkoutService.listAddresses(req.principal!.userId) }); }));
  router.post('/', asyncRoute(async (req, res) => { res.status(201).json({ data: await checkoutService.createAddress(req.principal!.userId, addressCreateSchema.parse(req.body)) }); }));
  router.patch('/:addressId', asyncRoute(async (req, res) => { res.json({ data: await checkoutService.updateAddress(req.principal!.userId, requiredParam(req.params.addressId), addressUpdateSchema.parse(req.body)) }); }));
  router.delete('/:addressId', asyncRoute(async (req, res) => { await checkoutService.deleteAddress(req.principal!.userId, requiredParam(req.params.addressId)); res.status(204).end(); }));
  return router;
}

export function createLocationRouter(checkoutService: CheckoutService): Router {
  const router = Router();
  router.get('/countries', asyncRoute(async (_req, res) => { res.json({ data: await checkoutService.listCountries() }); }));
  router.get('/states', asyncRoute(async (req, res) => { const query = locationQuerySchema.parse(req.query); res.json({ data: await checkoutService.listStates(query.countryId) }); }));
  router.get('/cities', asyncRoute(async (req, res) => { const query = locationQuerySchema.parse(req.query); res.json({ data: await checkoutService.listCities(query.stateProvinceId) }); }));
  return router;
}

export function createCheckoutRouter(authService: AuthService, checkoutService: CheckoutService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.post('/quote', asyncRoute(async (req, res) => { res.json({ data: await checkoutService.quote(req.principal!.userId, checkoutSchema.parse(req.body)) }); }));
  router.post('/', asyncRoute(async (req, res) => {
    const idempotencyKey = req.header('idempotency-key');
    if (!idempotencyKey) throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required.');
    res.status(201).json({ data: await checkoutService.checkout(req.principal!.userId, checkoutSchema.parse(req.body), idempotencyKeySchema.parse(idempotencyKey)) });
  }));
  return router;
}
