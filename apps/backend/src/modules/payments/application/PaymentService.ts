import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { PaymentRepository, PaymentWebhookInput } from '../domain/PaymentRepository.js';
import type { PaystackPaymentProvider } from '../infrastructure/PaystackPaymentProvider.js';

export class PaymentService {
  constructor(private readonly repository: PaymentRepository, private readonly paystack?: PaystackPaymentProvider) {}
  async createPayment(userId: string, orderId: string, provider: string, idempotencyKey: string) {
    if (provider.toUpperCase() === 'PAYSTACK' && (!env.PAYSTACK_SECRET_KEY || !this.paystack)) throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Paystack is not configured.');
    const payment = await this.repository.createPayment(userId, orderId, provider, idempotencyKey) as Record<string, unknown>;
    if (provider.toUpperCase() !== 'PAYSTACK') return payment;
    if (!this.repository.getPaymentInitializationContext) throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Payment initialization is not configured.');
    const context = await this.repository.getPaymentInitializationContext(userId, String(payment.id));
    if (!context) throw new AppError(404, 'NOT_FOUND', 'Payment not found.');
    if (context.status === 'PAID') return payment;
    const paystack = this.paystack;
    if (!paystack) throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Paystack is not configured.');
    const initialized = await paystack.initializeTransaction({ email: context.email, amountMinor: context.amountMinor, currency: context.currency, reference: context.providerReference, callbackUrl: env.PAYSTACK_CALLBACK_URL });
    return { ...payment, authorizationUrl: initialized.authorizationUrl, providerReference: initialized.reference };
  }
  getPayment(userId: string, paymentId: string) { return this.repository.findPaymentForUser(userId, paymentId).then((payment) => { if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found.'); return payment; }); }
  private verifySignature(rawBody: Buffer | string, signature: string) {
    if (!env.PAYSTACK_SECRET_KEY) throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Paystack is not configured.');
    const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
    const given = Buffer.from(signature.trim(), 'utf8'); const expectedBuffer = Buffer.from(expected, 'utf8');
    if (given.length !== expectedBuffer.length || !timingSafeEqual(given, expectedBuffer)) throw new AppError(401, 'INVALID_SIGNATURE', 'Payment webhook signature is invalid.');
  }
  async processPaystackWebhook(rawBody: Buffer, signature: string) {
    this.verifySignature(rawBody, signature);
    let event: Record<string, unknown>;
    try { event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>; } catch { throw new AppError(400, 'VALIDATION_ERROR', 'Webhook body is invalid JSON.'); }
    const data = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : {};
    const reference = typeof data.reference === 'string' ? data.reference : '';
    const amountMinor = typeof data.amount === 'number' && Number.isInteger(data.amount) ? data.amount : -1;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : '';
    const eventType = typeof event.event === 'string' ? event.event : 'unknown';
    if (!reference || amountMinor < 0 || !/^[A-Z]{3}$/.test(currency)) throw new AppError(400, 'VALIDATION_ERROR', 'Webhook payload is invalid.');
    if (!['charge.success', 'charge.failed', 'charge.reversed', 'charge.abandoned'].includes(eventType)) throw new AppError(400, 'UNSUPPORTED_EVENT', 'Paystack event type is not supported.');
    const eventId = typeof data.id === 'number' || typeof data.id === 'string' ? String(data.id) : createHash('sha256').update(`${eventType}|${reference}|${String(data.paid_at ?? data.transaction_date ?? '')}`).digest('hex');
    const status = eventType === 'charge.success' ? 'SUCCEEDED' : eventType.includes('failed') || eventType.includes('reversed') ? 'FAILED' : eventType.includes('abandoned') ? 'CANCELLED' : 'CANCELLED';
    if (status === 'SUCCEEDED' && this.paystack) {
      const verified = await this.paystack.verifyTransaction(reference);
      if (verified.status !== 'success' || verified.reference !== reference || verified.amountMinor !== amountMinor || verified.currency !== currency) throw new AppError(422, 'PAYMENT_MISMATCH', 'Verified payment does not match the expected transaction.');
    }
    return this.repository.processWebhook('PAYSTACK', { eventId, eventType, providerReference: reference, status, amountMinor, currency, payload: { event: eventType, data } });
  }
  async processWebhook(provider: string, input: PaymentWebhookInput, signature: string, rawBody?: Buffer) {
    if (provider.toUpperCase() === 'PAYSTACK' && rawBody) return this.processPaystackWebhook(rawBody, signature);
    const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(input.payload)).digest('hex');
    const given = Buffer.from(signature, 'utf8'); const expectedBuffer = Buffer.from(expected, 'utf8');
    if (given.length !== expectedBuffer.length || !timingSafeEqual(given, expectedBuffer)) throw new AppError(401, 'INVALID_SIGNATURE', 'Payment webhook signature is invalid.');
    return this.repository.processWebhook(provider, input);
  }
}
