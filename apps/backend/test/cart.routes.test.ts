import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createCartRouter } from '../src/modules/cart/presentation/cart.routes.js';
import { hashAnonymousCartToken } from '../src/modules/cart/presentation/anonymous-cart-cookie.js';

const userId = '550e8400-e29b-41d4-a716-446655440000'; const variantId = '660e8400-e29b-41d4-a716-446655440000'; const token = 'a'.repeat(64); const cart = { id: 'cart-1', currency: 'NGN', items: [] };
function app(service: Record<string, unknown>) { return createCartRouter({ authenticateAccessToken: async (value: string) => { if (value !== 'good') throw new Error('bad token'); return { userId, roles: [], permissions: [] }; } } as never, service as never); }
async function dispatch(router: ReturnType<typeof createCartRouter>, input: { method: string; url: string; authorization?: string; cookie?: string; body?: unknown; cookies?: Record<string, string> }) {
  return new Promise<{ status: number; body: unknown; cookies: Array<{ name: string; value: string; options: unknown }>; cleared: Array<{ name: string; options: unknown }> }>((resolve) => {
    const cookies: Array<{ name: string; value: string; options: unknown }> = []; const cleared: Array<{ name: string; options: unknown }> = [];
    const req = { method: input.method, url: input.url, originalUrl: input.url, baseUrl: '', body: input.body, cookies: input.cookies ?? (input.cookie ? { axm_cart: token } : {}), headers: input.authorization ? { authorization: input.authorization } : {}, header: (name: string) => input.authorization && name.toLowerCase() === 'authorization' ? input.authorization : undefined } as unknown as Request;
    const response = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { resolve({ status: this.statusCode, body, cookies, cleared }); return this; }, end() { resolve({ status: this.statusCode, body: undefined, cookies, cleared }); return this; }, cookie(name: string, value: string, options: unknown) { cookies.push({ name, value, options }); return this; }, clearCookie(name: string, options: unknown) { cleared.push({ name, options }); return this; } } as unknown as Response;
    router.handle(req, response, (error: { status?: number; code?: string } | undefined) => resolve({ status: error?.status ?? 500, body: { code: error?.code ?? 'INTERNAL_ERROR' }, cookies, cleared }));
  });
}

describe('cart HTTP ownership and cookie lifecycle', () => {
  it('issues an HttpOnly cookie for an anonymous cart without exposing its raw token', async () => {
    const addItem = vi.fn(async () => cart); const result = await dispatch(app({ addItem }), { method: 'POST', url: '/items', body: { productVariantId: variantId, quantity: 1 } }); expect(result.status).toBe(201); expect(result.cookies[0]).toMatchObject({ name: 'axm_cart' }); expect(result.cookies[0]?.options).toMatchObject({ httpOnly: true, sameSite: 'lax' }); expect(JSON.stringify(result.body)).not.toContain('axm_cart'); expect(addItem.mock.calls[0]?.[0]).toMatchObject({ kind: 'anonymous' });
  });
  it('rotates an expired or invalid anonymous capability before creating a new cart', async () => {
    const addItem = vi.fn(async () => cart); const result = await dispatch(app({ addItem, getCart: vi.fn(async () => ({ id: '', currency: 'NGN', items: [] })) }), { method: 'POST', url: '/items', cookie: `axm_cart=${token}`, body: { productVariantId: variantId, quantity: 1 } }); expect(result.status).toBe(201); expect(result.cookies[0]?.value).not.toBe(token); expect(addItem.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ kind: 'anonymous', tokenHash: expect.not.stringContaining(hashAnonymousCartToken(token)) }));
  });
  it('keeps normal authenticated cart CRUD separate from cookie-bound recovery CRUD', async () => {
    const updateItem = vi.fn(async () => cart); const service = { updateItem, getCart: vi.fn(async () => cart) }; const normal = await dispatch(app(service), { method: 'PATCH', url: '/items/item-1', authorization: 'Bearer good', cookie: `axm_cart=${token}`, body: { quantity: 2 } }); expect(normal.status).toBe(200); expect(updateItem.mock.calls[0]?.[0]).toEqual({ kind: 'authenticated', userId }); const recovery = await dispatch(app(service), { method: 'PATCH', url: '/recovery/items/item-1', authorization: 'Bearer good', cookie: `axm_cart=${token}`, body: { quantity: 2 } }); expect(recovery.status).toBe(200); expect(updateItem.mock.calls[1]?.[0]).toEqual({ kind: 'anonymous', tokenHash: hashAnonymousCartToken(token) });
  });
  it('rejects malformed bearer authentication and clears the anonymous cookie only after a successful merge', async () => {
    const mergeAnonymousCart = vi.fn(async () => cart); const rejected = await dispatch(app({ mergeAnonymousCart }), { method: 'POST', url: '/merge', authorization: 'broken', cookie: `axm_cart=${token}` }); expect(rejected.status).toBe(401); expect(mergeAnonymousCart).not.toHaveBeenCalled(); const merged = await dispatch(app({ mergeAnonymousCart }), { method: 'POST', url: '/merge', authorization: 'Bearer good', cookie: `axm_cart=${token}` }); expect(merged.status).toBe(200); expect(mergeAnonymousCart).toHaveBeenCalledWith(userId, hashAnonymousCartToken(token)); expect(merged.cleared[0]).toMatchObject({ name: 'axm_cart' });
  });
});
