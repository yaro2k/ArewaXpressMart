import { z } from 'zod';

const slug = z.string().trim().toLowerCase().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.');
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code.');
const id = z.string().uuid();
const productImageSchema = z.object({ storageKey: z.string().trim().min(1).max(500).regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, 'Storage key contains unsupported characters.'), altText: z.string().trim().min(1).max(300).optional(), position: z.number().int().min(0).max(100), variantId: id.optional() }).strict();

export const productCreateSchema = z.object({
  storeId: id,
  brandId: id.optional(),
  name: z.string().trim().min(2).max(180),
  slug,
  description: z.string().trim().min(10).max(10_000),
  categoryIds: z.array(id).min(1).max(8).refine((values) => new Set(values).size === values.length, 'Categories must be unique.'),
  options: z.array(z.object({ name: z.string().trim().min(1).max(80), values: z.array(z.string().trim().min(1).max(80)).min(1).max(30).refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, 'Option values must be unique.') })).max(3).refine((options) => new Set(options.map((option) => option.name.toLowerCase())).size === options.length, 'Option names must be unique.'),
  variants: z.array(z.object({ sku: z.string().trim().min(2).max(100), barcode: z.string().trim().min(4).max(100).optional(), weightGrams: z.number().int().positive().max(100_000).optional(), attributes: z.record(z.string().trim().min(1).max(80)), price: z.object({ amountMinor: z.number().int().nonnegative().max(2_000_000_000), currency }) })).min(1).max(100).refine((variants) => new Set(variants.map((variant) => variant.sku.toLowerCase())).size === variants.length, 'Variant SKUs must be unique.'),
  images: z.array(productImageSchema.omit({ variantId: true })).max(20).refine((images) => new Set(images.map((image) => image.position)).size === images.length, 'Image positions must be unique.').optional(),
}).strict();

export const productUpdateSchema = z.object({
  brandId: id.nullable().optional(),
  name: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  categoryIds: z.array(id).min(1).max(8).refine((values) => new Set(values).size === values.length, 'Categories must be unique.').optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');

export const productQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(160).optional(),
  brand: z.string().trim().min(1).max(160).optional(),
  store: z.string().trim().min(1).max(160).optional(),
  minPrice: z.coerce.number().int().nonnegative().max(2_000_000_000).optional(),
  maxPrice: z.coerce.number().int().nonnegative().max(2_000_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
}).strict().refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, 'minPrice cannot exceed maxPrice.');

export const catalogSlugSchema = z.object({ slug }).strict();
export const productImageCreateSchema = productImageSchema;
