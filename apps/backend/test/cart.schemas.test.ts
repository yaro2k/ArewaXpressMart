import { describe, expect, it } from 'vitest';
import { cartItemCreateSchema, cartItemUpdateSchema } from '../src/modules/cart/presentation/cart.schemas.js';

describe('cart request validation', () => {
  const variantId = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts bounded cart quantities', () => {
    expect(cartItemCreateSchema.parse({ productVariantId: variantId, quantity: 2 })).toEqual({ productVariantId: variantId, quantity: 2 });
  });

  it('rejects missing variant identifiers, zero quantities, and unknown fields', () => {
    expect(() => cartItemCreateSchema.parse({ productVariantId: variantId, quantity: 0 })).toThrow();
    expect(() => cartItemUpdateSchema.parse({ quantity: 1, price: 1 })).toThrow();
  });
});
