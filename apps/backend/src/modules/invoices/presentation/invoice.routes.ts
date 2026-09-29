import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication, requirePermission } from '../../../shared/presentation/auth.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { InvoiceService } from '../application/InvoiceService.js';
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const param = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };
export function createInvoiceRouter(authService: AuthService, service: InvoiceService): Router { const router = Router(); router.use(requireAuthentication(authService)); router.get('/orders/:orderId/invoice', asyncRoute(async (req, res) => { res.json({ data: await service.getCustomerInvoice(req.principal!.userId, param(req.params.orderId)) }); })); return router; }
export function createAdminInvoiceRouter(authService: AuthService, service: InvoiceService): Router { const router = Router(); router.use(requireAuthentication(authService), requirePermission('invoice:read:any')); router.get('/invoices', asyncRoute(async (_req, res) => { res.json({ data: await service.list() }); })); router.post('/orders/:orderId/invoice', requirePermission('invoice:issue'), asyncRoute(async (req, res) => { res.status(201).json({ data: await service.issue(param(req.params.orderId)) }); })); return router; }
