import { z } from 'zod';
export const reportQuerySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(200).default(100) }).strict().refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be before to.' });
