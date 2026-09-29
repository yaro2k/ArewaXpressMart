import { z } from 'zod';
const id = z.string().uuid();
export const returnCreateSchema = z.object({ reasonCode: z.string().trim().min(2).max(80), items: z.array(z.object({ orderItemId: id, quantity: z.number().int().min(1).max(1_000) }).strict()).min(1).max(100), note: z.string().trim().max(1_000).optional() }).strict();
export const returnUpdateSchema = z.object({ status: z.enum(['APPROVED', 'RECEIVED', 'REJECTED', 'CLOSED']), resolutionCode: z.string().trim().min(2).max(80).optional(), note: z.string().trim().max(1_000).optional() }).strict();
