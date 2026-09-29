import { z } from 'zod';

const id = z.string().uuid();
export const cartItemCreateSchema = z.object({ productVariantId: id, quantity: z.number().int().min(1).max(999) }).strict();
export const cartItemUpdateSchema = z.object({ quantity: z.number().int().min(1).max(999) }).strict();
