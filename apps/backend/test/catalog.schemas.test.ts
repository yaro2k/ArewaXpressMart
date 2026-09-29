import { describe, expect, it } from 'vitest';
import { catalogSlugSchema, productCreateSchema, productImageCreateSchema, productQuerySchema } from '../src/modules/catalog/presentation/catalog.schemas.js';

const id = '550e8400-e29b-41d4-a716-446655440000';

describe('catalog request schemas', () => {
  it('accepts a product with option-backed variants', () => {
    const result = productCreateSchema.parse({ storeId: id, name: 'Northern Weave Shirt', slug: 'northern-weave-shirt', description: 'A carefully woven shirt suitable for everyday wear.', categoryIds: [id], options: [{ name: 'Size', values: ['M', 'L'] }], variants: [{ sku: 'NWS-M', attributes: { Size: 'M' }, price: { amountMinor: 125000, currency: 'ngn' } }] });
    expect(result.variants[0].price.currency).toBe('NGN');
  });
  it('rejects variant attributes that are not strings', () => {
    expect(() => productCreateSchema.parse({ storeId: id, name: 'Northern Weave Shirt', slug: 'northern-weave-shirt', description: 'A carefully woven shirt suitable for everyday wear.', categoryIds: [id], options: [], variants: [{ sku: 'NWS-M', attributes: { Size: 1 }, price: { amountMinor: 125000, currency: 'NGN' } }] })).toThrow();
  });
  it('coerces and bounds public product filters', () => {
    expect(productQuerySchema.parse({ minPrice: '10', maxPrice: '20', limit: '12' })).toMatchObject({ minPrice: 10, maxPrice: 20, limit: 12 });
    expect(() => productQuerySchema.parse({ minPrice: '21', maxPrice: '20' })).toThrow();
  });
  it('validates product image metadata without accepting a URL or unsafe object key', () => {
    expect(productImageCreateSchema.parse({ storageKey: 'products/shirt-blue', altText: 'Blue shirt', position: 0 }).storageKey).toBe('products/shirt-blue');
    expect(() => productImageCreateSchema.parse({ storageKey: 'https://example.com/shirt.jpg', position: 0 })).toThrow();
  });
  it('normalizes public category and brand identifiers', () => {
    expect(catalogSlugSchema.parse({ slug: 'northern-fashion' }).slug).toBe('northern-fashion');
    expect(() => catalogSlugSchema.parse({ slug: 'Northern Fashion' })).toThrow();
  });
});
