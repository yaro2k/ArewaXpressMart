import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import type { CartService } from '../application/CartService.js';
import { cartItemCreateSchema, cartItemUpdateSchema } from './cart.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || value.length === 0) throw new Error('Required route parameter is missing.'); return value; };

export function createCartRouter(authService: AuthService, cartService: CartService): Router {
  const router = Router();
  router.use(requireAuthentication(authService));
  router.get('/', asyncRoute(async (req, res) => { res.json({ data: await cartService.getCart(req.principal!.userId) }); }));
  router.post('/items', asyncRoute(async (req, res) => { res.status(201).json({ data: await cartService.addItem(req.principal!.userId, cartItemCreateSchema.parse(req.body)) }); }));
  router.patch('/items/:cartItemId', asyncRoute(async (req, res) => { res.json({ data: await cartService.updateItem(req.principal!.userId, requiredParam(req.params.cartItemId), cartItemUpdateSchema.parse(req.body).quantity) }); }));
  router.delete('/items/:cartItemId', asyncRoute(async (req, res) => { await cartService.deleteItem(req.principal!.userId, requiredParam(req.params.cartItemId)); res.status(204).end(); }));
  return router;
}
