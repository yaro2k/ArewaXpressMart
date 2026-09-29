import { describe, expect, it, vi } from 'vitest';
import { CartService } from '../src/modules/cart/application/CartService.js';
import type { CartRepository } from '../src/modules/cart/domain/CartRepository.js';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const itemId = '660e8400-e29b-41d4-a716-446655440000';

function repository(overrides: Partial<CartRepository> = {}): CartRepository {
  return {
    getOrCreateCart: async () => ({ id: 'cart-1', items: [] }),
    addItem: async () => ({ id: 'cart-1', items: [] }),
    findCartItemOwner: async () => ({ userId }),
    updateItem: async () => ({ id: 'cart-1', items: [] }),
    deleteItem: async () => undefined,
    ...overrides,
  };
}

describe('CartService', () => {
  it('updates a cart item only after proving its cart belongs to the caller', async () => {
    const updateItem = vi.fn(async () => ({ id: 'cart-1', items: [] }));
    const service = new CartService(repository({ updateItem }));

    await expect(service.updateItem(userId, itemId, 3)).resolves.toEqual({ id: 'cart-1', items: [] });
    expect(updateItem).toHaveBeenCalledWith(itemId, 3);
  });

  it('does not disclose or modify another customer’s cart item', async () => {
    const updateItem = vi.fn();
    const service = new CartService(repository({ findCartItemOwner: async () => ({ userId: 'other-user' }), updateItem }));

    await expect(service.updateItem(userId, itemId, 3)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns not found for a missing cart item', async () => {
    const service = new CartService(repository({ findCartItemOwner: async () => null }));

    await expect(service.deleteItem(userId, itemId)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
