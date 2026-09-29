import { z } from 'zod';

const slug = z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.');
const warehouseCode = z.string().trim().toUpperCase().min(2).max(32).regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'Use uppercase letters, numbers, hyphens, and underscores only.');
const id = z.string().uuid();
export const sellerApplicationSchema = z.object({ legalName: z.string().trim().min(2).max(160), businessRegistration: z.string().trim().min(3).max(80).optional() }).strict();
export const sellerProfileUpdateSchema = z.object({ legalName: z.string().trim().min(2).max(160).optional(), businessRegistration: z.string().trim().min(3).max(80).nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
export const storeCreateSchema = z.object({ slug, displayName: z.string().trim().min(2).max(120), description: z.string().trim().max(2_000).optional() }).strict();
export const storeUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(2_000).nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
export const warehouseCreateSchema = z.object({ storeId: id, code: warehouseCode, name: z.string().trim().min(2).max(120) }).strict();
export const warehouseUpdateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
