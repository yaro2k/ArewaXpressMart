import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { OrdersService } from '../application/OrdersService.js';
import { cancelOrderSchema, shipmentCreateSchema, shipmentStatusSchema } from './orders.schemas.js';
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };
export function createOrdersRouter(authService: AuthService, ordersService: OrdersService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.get('/', asyncRoute(async (req, res) => { res.json({ data: await ordersService.list(req.principal!.userId) }); }));
  router.get('/:orderId', asyncRoute(async (req, res) => { const order = await ordersService.get(req.principal!.userId, requiredParam(req.params.orderId)); if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.'); res.json({ data: order }); }));
  router.post('/:orderId/cancel', asyncRoute(async (req, res) => { res.json({ data: await ordersService.cancel(req.principal!.userId, requiredParam(req.params.orderId), cancelOrderSchema.parse(req.body).reason) }); }));
  router.get('/:orderId/shipments', asyncRoute(async (req, res) => { res.json({ data: await ordersService.listShipments(req.principal!.userId, requiredParam(req.params.orderId)) }); }));
  return router;
}
export function createSellerOrdersRouter(authService: AuthService, ordersService: OrdersService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.get('/orders', asyncRoute(async (req, res) => { res.json({ data: await ordersService.listSellerItems(req.principal!.userId) }); }));
  router.post('/shipments', asyncRoute(async (req, res) => { const key = req.header('idempotency-key'); if (!key || key.length < 16) throw new AppError(400, 'VALIDATION_ERROR', 'A valid Idempotency-Key header is required.'); res.status(201).json({ data: await ordersService.createShipment(req.principal!.userId, { ...shipmentCreateSchema.parse(req.body), idempotencyKey: key }) }); }));
  router.patch('/shipments/:shipmentId/status', asyncRoute(async (req, res) => { res.json({ data: await ordersService.updateShipmentStatus(req.principal!.userId, requiredParam(req.params.shipmentId), shipmentStatusSchema.parse(req.body)) }); }));
  return router;
}
