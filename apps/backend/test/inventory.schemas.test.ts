import { describe, expect, it } from 'vitest';
import { inventoryAdjustmentSchema } from '../src/modules/inventory/presentation/inventory.schemas.js';
describe('inventory request validation', () => {
  it('accepts a non-zero bounded stock adjustment', () => { expect(inventoryAdjustmentSchema.parse({ warehouseId: '550e8400-e29b-41d4-a716-446655440000', productVariantId: '660e8400-e29b-41d4-a716-446655440000', quantityDelta: 10, referenceKey: 'manual-receipt-2026-001' }).quantityDelta).toBe(10); });
  it('rejects zero adjustments and short references', () => { expect(() => inventoryAdjustmentSchema.parse({ warehouseId: '550e8400-e29b-41d4-a716-446655440000', productVariantId: '660e8400-e29b-41d4-a716-446655440000', quantityDelta: 0, referenceKey: 'short' })).toThrow(); });
});
