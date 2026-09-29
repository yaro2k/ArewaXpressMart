import { describe, expect, it } from 'vitest';
import { paymentCreateSchema, webhookSchema } from '../src/modules/payments/presentation/payment.schemas.js';

describe('payment request validation', () => {
  it('normalizes supported providers and webhook currencies', () => {
    expect(paymentCreateSchema.parse({ provider: 'paystack' }).provider).toBe('PAYSTACK');
    expect(webhookSchema.parse({ eventId: 'evt-1', eventType: 'charge.success', providerReference: 'AXM-PAY-123456789', status: 'SUCCEEDED', amountMinor: 1000, currency: 'ngn', payload: {} }).currency).toBe('NGN');
  });
  it('rejects unsupported providers and malformed webhook amounts', () => {
    expect(() => paymentCreateSchema.parse({ provider: 'cash' })).toThrow();
    expect(() => webhookSchema.parse({ eventId: 'evt', eventType: 'x', providerReference: 'short', status: 'SUCCEEDED', amountMinor: -1, currency: 'NGN', payload: {} })).toThrow();
  });
});
