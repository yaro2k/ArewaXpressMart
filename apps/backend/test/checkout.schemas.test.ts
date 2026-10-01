import { describe, expect, it } from 'vitest';
import { addressCreateSchema, checkoutSchema, idempotencyKeySchema } from '../src/modules/checkout/presentation/checkout.schemas.js';

const cityId = '550e8400-e29b-41d4-a716-446655440000';
describe('checkout request validation', () => {
  it('accepts a saved address and checkout address references', () => {
    expect(addressCreateSchema.parse({ recipientName: 'Amina Yusuf', phoneE164: '+2348012345678', line1: '12 Market Road', cityId }).cityId).toBe(cityId);
    expect(checkoutSchema.parse({ shippingAddressId: cityId, shippingSelections: [{ storeId: cityId, shippingRateId: cityId }] }).shippingSelections).toHaveLength(1);
  });
  it('rejects invalid delivery details and short idempotency keys', () => {
    expect(() => addressCreateSchema.parse({ recipientName: 'Amina', phoneE164: '08012345678', line1: 'x', cityId })).toThrow();
    expect(() => checkoutSchema.parse({ shippingAddressId: cityId, shippingSelections: [] })).toThrow(); expect(() => idempotencyKeySchema.parse('short-key')).toThrow();
  });
});
