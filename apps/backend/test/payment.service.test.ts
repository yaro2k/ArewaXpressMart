import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentRepository } from '../src/modules/payments/domain/PaymentRepository.js';

process.env.PAYSTACK_SECRET_KEY ??= 'b'.repeat(32);

function repository(overrides: Partial<PaymentRepository> = {}): PaymentRepository { return { createPayment: async () => ({ id: 'payment-1' }), findPaymentForUser: async () => ({ id: 'payment-1' }), processWebhook: async () => ({ id: 'payment-1', status: 'PAID' }), ...overrides }; }
const webhook = { eventId: 'evt-1', eventType: 'charge.success', providerReference: 'AXM-PAY-123456789', status: 'SUCCEEDED' as const, amountMinor: 1000, currency: 'NGN', payload: { reference: 'AXM-PAY-123456789' } };

describe('PaymentService', () => {
  it('rejects a webhook with an invalid signature', async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'; process.env.WEB_ORIGIN ??= 'http://localhost:5173'; process.env.JWT_ISSUER ??= 'test'; process.env.JWT_AUDIENCE ??= 'test'; process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    const { PaymentService } = await import('../src/modules/payments/application/PaymentService.js');
    const service = new PaymentService(repository());
    await expect(service.processWebhook('PAYSTACK', webhook, 'invalid')).rejects.toMatchObject({ status: 401, code: 'INVALID_SIGNATURE' });
  });
  it('passes a correctly signed webhook to transactional persistence', async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'; process.env.WEB_ORIGIN ??= 'http://localhost:5173'; process.env.JWT_ISSUER ??= 'test'; process.env.JWT_AUDIENCE ??= 'test'; process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    const [{ PaymentService }, { env }] = await Promise.all([import('../src/modules/payments/application/PaymentService.js'), import('../src/config/env.js')]);
    const processWebhook = vi.fn(async () => ({ id: 'payment-1', status: 'PAID' })); const service = new PaymentService(repository({ processWebhook }));
    const signature = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(webhook.payload)).digest('hex');
    await expect(service.processWebhook('PAYSTACK', webhook, signature)).resolves.toEqual({ id: 'payment-1', status: 'PAID' });
    expect(processWebhook).toHaveBeenCalledWith('PAYSTACK', webhook);
  });
  it('verifies a raw Paystack success webhook before persistence', async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'; process.env.WEB_ORIGIN ??= 'http://localhost:5173'; process.env.JWT_ISSUER ??= 'test'; process.env.JWT_AUDIENCE ??= 'test'; process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32); process.env.PAYSTACK_SECRET_KEY ??= 'b'.repeat(32);
    const [{ PaymentService }, { env }] = await Promise.all([import('../src/modules/payments/application/PaymentService.js'), import('../src/config/env.js')]);
    const raw = Buffer.from(JSON.stringify({ event: 'charge.success', data: { id: 42, reference: 'AXM-PAY-123456789', amount: 1000, currency: 'NGN' } }));
    const provider = { verifyTransaction: vi.fn(async () => ({ status: 'success', reference: 'AXM-PAY-123456789', amountMinor: 1000, currency: 'NGN' })), initializeTransaction: vi.fn() };
    const processWebhook = vi.fn(async () => ({ id: 'payment-1', status: 'PAID' })); const service = new PaymentService(repository({ processWebhook }), provider);
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex');
    await expect(service.processPaystackWebhook(raw, signature)).resolves.toEqual({ id: 'payment-1', status: 'PAID' });
    expect(provider.verifyTransaction).toHaveBeenCalledWith('AXM-PAY-123456789');
  });
  it('requires the Paystack secret and exact raw body for Paystack webhooks', async () => {
    const { PaymentService } = await import('../src/modules/payments/application/PaymentService.js');
    const provider = { verifyTransaction: vi.fn(async () => ({ status: 'success', reference: 'AXM-PAY-123456789', amountMinor: 1000, currency: 'NGN' })), initializeTransaction: vi.fn() };
    const service = new PaymentService(repository(), provider);
    const raw = Buffer.from('{"event":"charge.success","data":{"reference":"AXM-PAY-123456789","amount":1000,"currency":"NGN"}}');
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex');
    await expect(service.processPaystackWebhook(Buffer.from(raw.toString().replace('1000', '1001')), signature)).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    const generic = createHmac('sha512', process.env.PAYMENT_WEBHOOK_SECRET ?? 'development-payment-webhook-secret').update(raw).digest('hex');
    await expect(service.processPaystackWebhook(raw, generic)).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });
  it('rejects malformed JSON and unsupported events after signature verification', async () => {
    const { PaymentService } = await import('../src/modules/payments/application/PaymentService.js');
    const service = new PaymentService(repository());
    const malformed = Buffer.from('{'); const malformedSig = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(malformed).digest('hex');
    await expect(service.processPaystackWebhook(malformed, malformedSig)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const raw = Buffer.from(JSON.stringify({ event: 'foo.bar', data: { reference: 'AXM-PAY-123456789', amount: 1000, currency: 'NGN' } })); const sig = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex');
    await expect(service.processPaystackWebhook(raw, sig)).rejects.toMatchObject({ code: 'UNSUPPORTED_EVENT' });
  });
  it('fails Paystack initialization explicitly when no provider adapter is configured', async () => {
    const { PaymentService } = await import('../src/modules/payments/application/PaymentService.js');
    const service = new PaymentService(repository());
    await expect(service.createPayment('user-1', 'order-1', 'PAYSTACK', 'idempotency-key-123456')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
  it('reuses the same pending payment reference across different idempotency keys', async () => {
    const { PaymentService } = await import('../src/modules/payments/application/PaymentService.js');
    const payment = { id: 'payment-1', status: 'PENDING', providerReference: 'AXM-PAY-123456789' };
    const createPayment = vi.fn(async () => payment);
    const repositoryWithContext = { ...repository({ createPayment }), getPaymentInitializationContext: async () => ({ email: 'buyer@example.com', amountMinor: 1000n, currency: 'NGN', providerReference: payment.providerReference, status: 'PENDING' }) };
    const initializeTransaction = vi.fn(async () => ({ authorizationUrl: 'https://paystack.test', accessCode: 'a', reference: payment.providerReference }));
    const service = new PaymentService(repositoryWithContext, { initializeTransaction, verifyTransaction: vi.fn() });
    const first = await service.createPayment('user-1', 'order-1', 'PAYSTACK', 'key-aaaaaaaaaaaaaa');
    const second = await service.createPayment('user-1', 'order-1', 'PAYSTACK', 'key-bbbbbbbbbbbbbb');
    expect(first.providerReference).toBe(second.providerReference);
    expect(initializeTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({ reference: payment.providerReference }));
    expect(initializeTransaction).toHaveBeenNthCalledWith(2, expect.objectContaining({ reference: payment.providerReference }));
  });
});
