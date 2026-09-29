import { z } from 'zod';

const password = z.string().min(12).max(128).regex(/[a-z]/, 'Must include a lowercase letter.').regex(/[A-Z]/, 'Must include an uppercase letter.').regex(/\d/, 'Must include a number.');
export const registerSchema = z.object({ email: z.string().email().max(254), password, firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).optional() }).strict();
export const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }).strict();
export const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const emailSchema = z.object({ email: z.string().email().max(254) }).strict();
export const googleSchema = z.object({ idToken: z.string().min(20).max(8192) }).strict();
export const passwordResetConfirmSchema = z.object({ token: z.string().min(32).max(256), newPassword: password }).strict();
export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one profile field is required.' });
