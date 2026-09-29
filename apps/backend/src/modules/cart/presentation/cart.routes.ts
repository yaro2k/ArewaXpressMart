import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/domain/AppError.js';
import { optionalAuthentication, requireAuthentication } from '../../../shared/presentation/auth.js';
import type { AuthService } from '../../identity/application/AuthService.js';
import type { CartService } from '../application/CartService.js';
import type { CartOwner } from '../domain/CartRepository.js';
import { clearAnonymousCartCookie, createAnonymousCartToken, hashAnonymousCartToken, readAnonymousCartToken, setAnonymousCartCookie } from './anonymous-cart-cookie.js';
import { cartItemCreateSchema, cartItemUpdateSchema } from './cart.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || value.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };
const expiry = () => new Date(Date.now() + env.ANONYMOUS_CART_TTL_DAYS * 86_400_000);
type CartSummary = { id: string; currency: string; items: unknown[] };
function existingOwner(req: Request): CartOwner | undefined { if (req.principal) return { kind: 'authenticated', userId: req.principal.userId }; const token = readAnonymousCartToken(req); return token ? { kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) } : undefined; }

export function createCartRouter(authService: AuthService, cartService: CartService): Router {
  const router = Router(); router.use(optionalAuthentication(authService));
  router.get('/', asyncRoute(async (req, res) => { const owner = existingOwner(req); res.json({ data: owner ? await cartService.getCart(owner) : { id: '', currency: 'NGN', items: [] } }); }));
  router.post('/items', asyncRoute(async (req, res) => {
    let owner = existingOwner(req); let token: string | undefined;
    if (owner?.kind === 'anonymous' && !(await cartService.getCart(owner) as CartSummary).id) { token = createAnonymousCartToken(); owner = { kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }; }
    if (!owner) { token = createAnonymousCartToken(); owner = { kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }; }
    const input = cartItemCreateSchema.parse(req.body); let cart: unknown;
    try { cart = await cartService.addItem(owner, { ...input, ...(owner.kind === 'anonymous' ? { expiresAt: expiry() } : {}) }); }
    catch (error) { if (!(owner.kind === 'anonymous' && error instanceof AppError && error.code === 'ANONYMOUS_CART_EXPIRED')) throw error; token = createAnonymousCartToken(); owner = { kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }; cart = await cartService.addItem(owner, { ...input, expiresAt: expiry() }); }
    if (token) setAnonymousCartCookie(res, token); res.status(201).json({ data: cart });
  }));
  router.patch('/items/:cartItemId', asyncRoute(async (req, res) => { const owner = existingOwner(req); if (!owner) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.'); res.json({ data: await cartService.updateItem(owner, requiredParam(req.params.cartItemId), cartItemUpdateSchema.parse(req.body).quantity) }); }));
  router.delete('/items/:cartItemId', asyncRoute(async (req, res) => { const owner = existingOwner(req); if (!owner) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.'); await cartService.deleteItem(owner, requiredParam(req.params.cartItemId)); res.status(204).end(); }));
  router.get('/recovery', requireAuthentication(authService), asyncRoute(async (req, res) => { const token = readAnonymousCartToken(req); res.json({ data: token ? await cartService.getCart({ kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }) : { id: '', currency: 'NGN', items: [] } }); }));
  router.patch('/recovery/items/:cartItemId', requireAuthentication(authService), asyncRoute(async (req, res) => { const token = readAnonymousCartToken(req); if (!token) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.'); res.json({ data: await cartService.updateItem({ kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }, requiredParam(req.params.cartItemId), cartItemUpdateSchema.parse(req.body).quantity) }); }));
  router.delete('/recovery/items/:cartItemId', requireAuthentication(authService), asyncRoute(async (req, res) => { const token = readAnonymousCartToken(req); if (!token) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.'); await cartService.deleteItem({ kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) }, requiredParam(req.params.cartItemId)); res.status(204).end(); }));
  router.post('/merge', requireAuthentication(authService), asyncRoute(async (req, res) => { const token = readAnonymousCartToken(req); const cart = await cartService.mergeAnonymousCart(req.principal!.userId, token ? hashAnonymousCartToken(token) : undefined); if (token) clearAnonymousCartCookie(res); res.json({ data: cart }); }));
  return router;
}
