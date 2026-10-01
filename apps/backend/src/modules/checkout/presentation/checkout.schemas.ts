import { z } from 'zod';

const id = z.string().uuid();
const phoneE164 = z.string().regex(/^\+[1-9]\d{6,14}$/);
const addressFields = {
  recipientName: z.string().trim().min(1).max(160), phoneE164,
  line1: z.string().trim().min(2).max(200), line2: z.string().trim().min(1).max(200).nullable().optional(),
  cityId: id, postalCode: z.string().trim().min(2).max(30).nullable().optional(),
  isDefaultShipping: z.boolean().optional(), isDefaultBilling: z.boolean().optional(),
};

export const addressCreateSchema = z.object(addressFields).strict();
export const addressUpdateSchema = z.object({ recipientName: addressFields.recipientName.optional(), phoneE164: phoneE164.optional(), line1: addressFields.line1.optional(), line2: addressFields.line2, cityId: id.optional(), postalCode: addressFields.postalCode, isDefaultShipping: z.boolean().optional(), isDefaultBilling: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
const shippingSelectionSchema = z.object({ storeId: id, shippingRateId: id }).strict();
export const shippingOptionsSchema = z.object({ shippingAddressId: id }).strict();
export const checkoutSchema = z.object({ shippingAddressId: id, billingAddressId: id.optional(), shippingSelections: z.array(shippingSelectionSchema).min(1).max(100) }).strict();
export const idempotencyKeySchema = z.string().trim().min(16).max(255);
export const locationQuerySchema = z.object({ countryId: id.optional(), stateProvinceId: id.optional() }).strict();
