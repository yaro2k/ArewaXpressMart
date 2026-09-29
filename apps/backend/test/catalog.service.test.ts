import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../src/modules/catalog/application/CatalogService.js';
import type { CatalogRepository, ProductCreateInput } from '../src/modules/catalog/domain/CatalogRepository.js';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const storeId = '660e8400-e29b-41d4-a716-446655440000';
const createInput: ProductCreateInput = {
  storeId,
  name: 'Northern Weave Shirt',
  slug: 'northern-weave-shirt',
  description: 'A carefully woven shirt suitable for everyday wear.',
  categoryIds: ['770e8400-e29b-41d4-a716-446655440000'],
  options: [],
  variants: [{ sku: 'NWS-ONE', attributes: {}, price: { amountMinor: 125000, currency: 'NGN' } }],
};

function repository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    listCategories: async () => [], findActiveCategoryBySlug: async () => null,
    listBrands: async () => [], findBrandBySlug: async () => null,
    listPublicProducts: async () => [], findPublicProduct: async () => null, listSellerProducts: async () => [],
    findStoreOwner: async () => ({ userId: sellerId, verificationStatus: 'VERIFIED', status: 'ACTIVE' }),
    findProductOwner: async () => ({ userId: sellerId }),
    createProduct: async () => ({ id: 'product-1' }), updateProduct: async () => ({ id: 'product-1' }),
    archiveProduct: async () => undefined, createProductImage: async () => ({ id: 'image-1' }),
    ...overrides,
  };
}

describe('CatalogService', () => {
  it('creates a product only for the verified owner of an active store', async () => {
    const createProduct = vi.fn(async () => ({ id: 'product-1' }));
    const service = new CatalogService(repository({ createProduct }));

    await expect(service.createProduct(sellerId, createInput)).resolves.toEqual({ id: 'product-1' });
    expect(createProduct).toHaveBeenCalledWith(createInput);
  });

  it('rejects product creation when the caller does not own the store', async () => {
    const service = new CatalogService(repository({ findStoreOwner: async () => ({ userId: 'other-user', verificationStatus: 'VERIFIED', status: 'ACTIVE' }) }));

    await expect(service.createProduct(sellerId, createInput)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects product creation for a seller who has not been verified', async () => {
    const service = new CatalogService(repository({ findStoreOwner: async () => ({ userId: sellerId, verificationStatus: 'PENDING', status: 'ACTIVE' }) }));

    await expect(service.createProduct(sellerId, createInput)).rejects.toMatchObject({ status: 403, code: 'INVALID_STORE_STATE' });
  });
});
