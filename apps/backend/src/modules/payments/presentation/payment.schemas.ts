import { z } from 'zod';

const provider = z.string().trim().toUpperCase().pipe(z.enum(['PAYSTACK', 'STRIPE']));
const id = z.string().uuid();
export const paymentCreateSchema = z.object({ provider }).strict();
export const webhookSchema = z.object({ eventId: z.string().trim().min(1).max(255), eventType: z.string().trim().min(1).max(100), providerReference: z.string().trim().min(10).max(255), status: z.enum(['SUCCEEDED', 'FAILED', 'CANCELLED']), amountMinor: z.number().int().nonnegative().max(2_000_000_000), currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), payload: z.record(z.unknown()) }).strict();
export const paymentIdSchema = z.object({ paymentId: id }).strict();
