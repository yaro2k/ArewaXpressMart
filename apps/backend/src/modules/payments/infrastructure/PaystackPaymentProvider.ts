import { AppError } from '../../../shared/domain/AppError.js';

export interface PaystackInitialization {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerification {
  status: string;
  reference: string;
  amountMinor: number;
  currency: string;
}

export interface PaystackPaymentProvider {
  initializeTransaction(input: { email: string; amountMinor: bigint; currency: string; reference: string; callbackUrl: string }): Promise<PaystackInitialization>;
  verifyTransaction(reference: string): Promise<PaystackVerification>;
}

type PaystackResponse = { status?: unknown; message?: unknown; data?: Record<string, unknown> };

export class PaystackHttpProvider implements PaystackPaymentProvider {
  constructor(private readonly secretKey: string, private readonly baseUrl = 'https://api.paystack.co', private readonly timeoutMs = 10000, private readonly fetchImpl: typeof fetch = fetch) {}

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal, headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
      let body: PaystackResponse;
      try { body = await response.json() as PaystackResponse; } catch { throw new AppError(502, 'PROVIDER_INVALID_RESPONSE', 'Payment provider returned invalid JSON.'); }
      if (!response.ok || body.status !== true || !body.data || typeof body.data !== 'object') throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'Payment provider request failed.');
      return body.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'Payment provider is unavailable.');
    } finally { clearTimeout(timer); }
  }

  async initializeTransaction(input: { email: string; amountMinor: bigint; currency: string; reference: string; callbackUrl: string }): Promise<PaystackInitialization> {
    const data = await this.request('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: input.email, amount: input.amountMinor.toString(), currency: input.currency, reference: input.reference, callback_url: input.callbackUrl }) });
    const authorizationUrl = typeof data.authorization_url === 'string' ? data.authorization_url : '';
    const accessCode = typeof data.access_code === 'string' ? data.access_code : '';
    const reference = typeof data.reference === 'string' ? data.reference : '';
    if (!authorizationUrl || !accessCode || !reference || reference !== input.reference) throw new AppError(502, 'PROVIDER_INVALID_RESPONSE', 'Payment provider initialization response is incomplete or mismatched.');
    return { authorizationUrl, accessCode, reference };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerification> {
    const data = await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
    const status = typeof data.status === 'string' ? data.status : '';
    const providerReference = typeof data.reference === 'string' ? data.reference : '';
    const amount = typeof data.amount === 'number' && Number.isInteger(data.amount) ? data.amount : -1;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : '';
    if (!status || !providerReference || amount < 0 || !/^[A-Z]{3}$/.test(currency)) throw new AppError(502, 'PROVIDER_INVALID_RESPONSE', 'Payment provider verification response is incomplete.');
    return { status, reference: providerReference, amountMinor: amount, currency };
  }
}
