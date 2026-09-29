import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { PaymentService } from '../application/PaymentService.js';
import { paymentCreateSchema, paymentIdSchema, webhookSchema } from './payment.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };

export function createPaymentRouter(authService: AuthService, paymentService: PaymentService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.post('/orders/:orderId/payments', asyncRoute(async (req, res) => { const key = req.header('idempotency-key'); if (!key || key.length < 16) throw new AppError(400, 'VALIDATION_ERROR', 'A valid Idempotency-Key header is required.'); const body = paymentCreateSchema.parse(req.body); res.status(201).json({ data: await paymentService.createPayment(req.principal!.userId, requiredParam(req.params.orderId), body.provider, key) }); }));
  router.get('/payments/:paymentId', asyncRoute(async (req, res) => { res.json({ data: await paymentService.getPayment(req.principal!.userId, paymentIdSchema.parse(req.params).paymentId) }); }));
  return router;
}

export function createPaymentWebhookRouter(paymentService: PaymentService): Router {
  const router = Router();
  router.post('/:provider', asyncRoute(async (req, res) => {
    const provider = requiredParam(req.params.provider).toUpperCase();
    const signature = req.header(provider === 'PAYSTACK' ? 'x-paystack-signature' : 'x-provider-signature');
    if (!signature) throw new AppError(401, 'INVALID_SIGNATURE', 'Payment webhook signature is required.');
    if (provider === 'PAYSTACK') {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody) throw new AppError(400, 'INVALID_SIGNATURE', 'Paystack webhooks require the captured raw request body.');
      await paymentService.processPaystackWebhook(rawBody, signature);
    }
    else { const input = webhookSchema.parse(req.body); await paymentService.processWebhook(provider, input, signature); }
    res.status(204).end();
  }));
  return router;
}
