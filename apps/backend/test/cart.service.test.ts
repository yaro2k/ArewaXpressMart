import { describe, expect, it, vi } from 'vitest';
import { CartService } from '../src/modules/cart/application/CartService.js';
import type { CartRepository } from '../src/modules/cart/domain/CartRepository.js';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const itemId = '660e8400-e29b-41d4-a716-446655440000';
const anonymous = { kind: 'anonymous' as const, tokenHash: 'a'.repeat(64) };
function repository(overrides: Partial<CartRepository> = {}): CartRepository { return { getCart: async () => ({ id: 'cart-1', items: [] }), addItem: async () => ({ id: 'cart-1', items: [] }), updateItem: async () => ({ id: 'cart-1', items: [] }), deleteItem: async () => undefined, mergeAnonymousCart: async () => ({ id: 'cart-1', items: [] }), ...overrides }; }

describe('CartService', () => {
  it('passes authenticated ownership context to cart mutations', async () => {
    const updateItem = vi.fn(async () => ({ id: 'cart-1', items: [] })); const service = new CartService(repository({ updateItem }));
    await expect(service.updateItem({ kind: 'authenticated', userId }, itemId, 3)).resolves.toEqual({ id: 'cart-1', items: [] });
    expect(updateItem).toHaveBeenCalledWith({ kind: 'authenticated', userId }, itemId, 3);
  });
  it('passes opaque anonymous ownership context without exposing a user identity', async () => {
    const addItem = vi.fn(async () => ({ id: 'cart-1', items: [] })); const service = new CartService(repository({ addItem }));
    await service.addItem(anonymous, { productVariantId: userId, quantity: 2, expiresAt: new Date('2026-10-01') });
    expect(addItem).toHaveBeenCalledWith(anonymous, expect.objectContaining({ quantity: 2 }));
  });
  it('delegates merge using only the authenticated user and anonymous token hash', async () => {
    const mergeAnonymousCart = vi.fn(async () => ({ id: 'cart-1', items: [] })); const service = new CartService(repository({ mergeAnonymousCart }));
    await service.mergeAnonymousCart(userId, anonymous.tokenHash);
    expect(mergeAnonymousCart).toHaveBeenCalledWith(userId, anonymous.tokenHash);
  });
});
