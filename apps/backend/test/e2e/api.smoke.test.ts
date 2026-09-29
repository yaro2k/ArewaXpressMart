import { describe, expect, it } from 'vitest';

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '');
const request = async (path: string, init?: RequestInit): Promise<Response> => { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5_000); try { return await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal }); } finally { clearTimeout(timeout); } };

describe.skipIf(!baseUrl)('deployed API smoke tests (set E2E_BASE_URL to enable)', () => {
  it('serves liveness with a correlation id', async () => { const response = await request('/health/live'); expect(response.status).toBe(200); expect(response.headers.get('x-request-id')).toBeTruthy(); expect((await response.json()).data.status).toBe('ok'); });
  it('serves readiness with the standard envelope', async () => { const response = await request('/health/ready'); expect([200, 503]).toContain(response.status); expect(response.headers.get('x-request-id')).toBeTruthy(); });
  it('protects metrics and authenticated routes', async () => { const metrics = await request('/metrics'); expect(metrics.status).toBe(401); const orders = await request('/api/v1/orders'); expect(orders.status).toBe(401); });
});
