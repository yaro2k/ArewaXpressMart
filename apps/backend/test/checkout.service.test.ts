import { describe, expect, it, vi } from 'vitest';
import { CheckoutService } from '../src/modules/checkout/application/CheckoutService.js';
import type { CheckoutRepository } from '../src/modules/checkout/domain/CheckoutRepository.js';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const addressId = '660e8400-e29b-41d4-a716-446655440000';
const checkout = { shippingAddressId: addressId };

function repository(overrides: Partial<CheckoutRepository> = {}): CheckoutRepository {
  return {
    listAddresses: async () => [], createAddress: async () => ({ id: addressId }), findAddressOwner: async () => ({ userId }), updateAddress: async () => ({ id: addressId }), deleteAddress: async () => undefined,
    quote: async () => ({ totalMinor: 1000 }), findOrderByIdempotencyKey: async () => null, placeOrder: async () => ({ id: 'order-1' }), ...overrides,
  };
}
describe('CheckoutService', () => {
  it('enforces address ownership before an update', async () => {
    const updateAddress = vi.fn(async () => ({ id: addressId })); const service = new CheckoutService(repository({ updateAddress }));
    await expect(service.updateAddress(userId, addressId, { line1: '14 Market Road' })).resolves.toEqual({ id: addressId });
    expect(updateAddress).toHaveBeenCalledWith(addressId, { line1: '14 Market Road' });
  });
  it('rejects another customer’s address', async () => {
    const service = new CheckoutService(repository({ findAddressOwner: async () => ({ userId: 'other-user' }) }));
    await expect(service.deleteAddress(userId, addressId)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  it('returns an idempotent prior order without placing another order', async () => {
    const placeOrder = vi.fn(async () => ({ id: 'new-order' })); const service = new CheckoutService(repository({ findOrderByIdempotencyKey: async () => ({ id: 'existing-order' }), placeOrder }));
    await expect(service.checkout(userId, checkout, '8bd35aa7-5e69-4e3b-a320-000000000001')).resolves.toEqual({ id: 'existing-order' });
    expect(placeOrder).not.toHaveBeenCalled();
  });
});
