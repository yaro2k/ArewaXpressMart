import { describe, expect, it } from 'vitest';
import { sellerApplicationSchema, storeCreateSchema, warehouseCreateSchema } from '../src/modules/seller/presentation/seller.schemas.js';

describe('seller request validation', () => {
  it('accepts a valid seller application', () => {
    expect(sellerApplicationSchema.parse({ legalName: 'Arewa Textiles Ltd', businessRegistration: 'RC-123456' }).legalName).toBe('Arewa Textiles Ltd');
  });
  it('normalizes a valid store slug', () => {
    expect(storeCreateSchema.parse({ slug: 'Arewa-Textiles', displayName: 'Arewa Textiles' }).slug).toBe('arewa-textiles');
  });
  it('rejects unsafe store slugs', () => {
    expect(() => storeCreateSchema.parse({ slug: 'Arewa Store!', displayName: 'Arewa' })).toThrow();
  });
  it('normalizes a warehouse code and rejects unsafe values', () => {
    const result = warehouseCreateSchema.parse({ storeId: '550e8400-e29b-41d4-a716-446655440000', code: ' north_01 ', name: 'Northern hub' });
    expect(result.code).toBe('NORTH_01');
    expect(() => warehouseCreateSchema.parse({ storeId: '550e8400-e29b-41d4-a716-446655440000', code: 'North 01', name: 'Northern hub' })).toThrow();
  });
});
