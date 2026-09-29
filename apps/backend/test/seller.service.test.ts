import { describe, expect, it, vi } from 'vitest';
import { SellerService } from '../src/modules/seller/application/SellerService.js';
import type { SellerRepository } from '../src/modules/seller/domain/SellerRepository.js';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const profileId = '660e8400-e29b-41d4-a716-446655440000';
const storeId = '770e8400-e29b-41d4-a716-446655440000';

function repository(overrides: Partial<SellerRepository> = {}): SellerRepository {
  return {
    createProfile: async () => ({ id: profileId, userId, legalName: 'Arewa Textiles Ltd', businessRegistration: null, verificationStatus: 'VERIFIED' }),
    findProfileByUserId: async () => ({ id: profileId, userId, legalName: 'Arewa Textiles Ltd', businessRegistration: null, verificationStatus: 'VERIFIED' }),
    updateProfile: async () => ({ id: profileId, userId, legalName: 'Arewa Textiles Ltd', businessRegistration: null, verificationStatus: 'VERIFIED' }),
    createStore: async () => ({ id: storeId, slug: 'arewa-textiles', displayName: 'Arewa Textiles', description: null, status: 'DRAFT', sellerProfileId: profileId }),
    findStoresByUserId: async () => [],
    findStoreById: async () => ({ id: storeId, slug: 'arewa-textiles', displayName: 'Arewa Textiles', description: null, status: 'DRAFT', sellerProfileId: profileId }),
    findPublicStoreBySlug: async () => null,
    updateStore: async () => ({ id: storeId, slug: 'arewa-textiles', displayName: 'Arewa Textiles', description: null, status: 'DRAFT', sellerProfileId: profileId }),
    findWarehousesByUserId: async () => [],
    findWarehouseById: async () => ({ id: '880e8400-e29b-41d4-a716-446655440000', storeId, code: 'NORTH_01', name: 'Northern hub', isActive: true }),
    createWarehouse: async () => ({ id: '880e8400-e29b-41d4-a716-446655440000', storeId, code: 'NORTH_01', name: 'Northern hub', isActive: true }),
    updateWarehouse: async () => ({ id: '880e8400-e29b-41d4-a716-446655440000', storeId, code: 'NORTH_01', name: 'Northern hub', isActive: false }),
    ...overrides,
  };
}

describe('SellerService warehouses', () => {
  it('creates a warehouse only for the verified owner of its store', async () => {
    const createWarehouse = vi.fn(async () => ({ id: 'warehouse-1' }));
    const service = new SellerService(repository({ createWarehouse }));

    await expect(service.createWarehouse(userId, { storeId, code: 'NORTH_01', name: 'Northern hub' })).resolves.toEqual({ id: 'warehouse-1' });
    expect(createWarehouse).toHaveBeenCalledWith({ storeId, code: 'NORTH_01', name: 'Northern hub' });
  });

  it('rejects warehouse creation for a seller awaiting verification', async () => {
    const service = new SellerService(repository({ findProfileByUserId: async () => ({ id: profileId, userId, legalName: 'Arewa Textiles Ltd', businessRegistration: null, verificationStatus: 'PENDING' }) }));

    await expect(service.createWarehouse(userId, { storeId, code: 'NORTH_01', name: 'Northern hub' })).rejects.toMatchObject({ status: 403, code: 'SELLER_NOT_VERIFIED' });
  });

  it('rejects warehouse updates by a seller who does not own its store', async () => {
    const service = new SellerService(repository({ findStoreById: async () => ({ id: storeId, slug: 'other-store', displayName: 'Other Store', description: null, status: 'ACTIVE', sellerProfileId: 'other-profile' }) }));

    await expect(service.updateWarehouse(userId, '880e8400-e29b-41d4-a716-446655440000', { isActive: false })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
