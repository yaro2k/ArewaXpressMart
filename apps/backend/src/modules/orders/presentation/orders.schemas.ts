import { z } from 'zod';
const id = z.string().uuid();
export const shipmentCreateSchema = z.object({ orderId: id, warehouseId: id, shippingMethodId: id, items: z.array(z.object({ orderItemId: id, quantity: z.number().int().min(1).max(1_000) }).strict()).min(1).max(100), trackingNumber: z.string().trim().min(3).max(255).optional() }).strict();
export const shipmentStatusSchema = z.object({ status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']), location: z.string().trim().max(200).optional(), details: z.string().trim().max(1_000).optional() }).strict();
export const cancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() }).strict();
