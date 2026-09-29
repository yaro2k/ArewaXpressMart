import { z } from 'zod';
const id = z.string().uuid();
export const inventoryAdjustmentSchema = z.object({ warehouseId: id, productVariantId: id, quantityDelta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, 'Quantity delta cannot be zero.'), referenceKey: z.string().trim().min(16).max(255) }).strict();
