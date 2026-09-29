import { describe, expect, it, vi } from 'vitest';
import { PaystackHttpProvider } from '../src/modules/payments/infrastructure/PaystackPaymentProvider.js';

const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('PaystackHttpProvider', () => {
  it('initializes a transaction and validates the response shape', async () => {
    const fetch = vi.fn(async () => response({ status: true, data: { authorization_url: 'https://paystack.test/abc', access_code: 'abc', reference: 'AXM-PAY-1' } }));
    const provider = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, fetch);
    await expect(provider.initializeTransaction({ email: 'buyer@example.com', amountMinor: 150000n, currency: 'NGN', reference: 'AXM-PAY-1', callbackUrl: 'http://localhost:5173/payment/return' })).resolves.toEqual({ authorizationUrl: 'https://paystack.test/abc', accessCode: 'abc', reference: 'AXM-PAY-1' });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ headers: expect.objectContaining({ Authorization: 'Bearer test-secret' }) });
  });
  it('rejects non-success or malformed provider responses', async () => {
    const provider = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => response({ status: false }, false)));
    await expect(provider.verifyTransaction('AXM-PAY-1')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
  it('handles network failure, timeout, and malformed responses safely', async () => {
    const network = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => { throw new Error('offline'); }));
    await expect(network.verifyTransaction('AXM-PAY-1')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    const timeout = new PaystackHttpProvider('test-secret', 'https://api.test', 5, vi.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))));
    await expect(timeout.verifyTransaction('AXM-PAY-1')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    const malformed = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) as Response));
    await expect(malformed.verifyTransaction('AXM-PAY-1')).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
  });
  it('rejects missing or malformed initialization fields', async () => {
    const missingUrl = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => response({ status: true, data: { access_code: 'a', reference: 'r' } })));
    await expect(missingUrl.initializeTransaction({ email: 'a@b.co', amountMinor: 1n, currency: 'NGN', reference: 'r', callbackUrl: 'http://localhost' })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
    const mismatch = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => response({ status: true, data: { authorization_url: 'https://x', access_code: 'a', reference: 'other' } })));
    await expect(mismatch.initializeTransaction({ email: 'a@b.co', amountMinor: 1n, currency: 'NGN', reference: 'r', callbackUrl: 'http://localhost' })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
  });
  it('maps a verified transaction response', async () => {
    const provider = new PaystackHttpProvider('test-secret', 'https://api.test', 1000, vi.fn(async () => response({ status: true, data: { status: 'success', reference: 'AXM-PAY-1', amount: 150000, currency: 'NGN' } })));
    await expect(provider.verifyTransaction('AXM-PAY-1')).resolves.toEqual({ status: 'success', reference: 'AXM-PAY-1', amountMinor: 150000, currency: 'NGN' });
  });
});
