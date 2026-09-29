import { describe, expect, it } from 'vitest';

describe('anonymous cart cookie identifiers', () => {
  it('creates opaque random tokens and persists only a deterministic hash', async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/arewaexpressmart_test';
    process.env.WEB_ORIGIN ??= 'http://localhost:5173'; process.env.JWT_ISSUER ??= 'test'; process.env.JWT_AUDIENCE ??= 'test'; process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    const { createAnonymousCartToken, hashAnonymousCartToken } = await import('../src/modules/cart/presentation/anonymous-cart-cookie.js');
    const first = createAnonymousCartToken(); const second = createAnonymousCartToken(); const hash = hashAnonymousCartToken(first);
    expect(first).not.toBe(second); expect(first).toMatch(/^[A-Za-z0-9_-]+$/); expect(hash).toHaveLength(64); expect(hash).not.toContain(first); expect(hash).toBe(hashAnonymousCartToken(first));
  });
});
