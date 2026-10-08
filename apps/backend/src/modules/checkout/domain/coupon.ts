import { AppError } from '../../../shared/domain/AppError.js';

export type CouponLine = { productVariantId: string; productId: string; categoryIds: string[]; grossMinor: bigint };
export type CouponConfig = { id: string; code: string; discountType: 'PERCENTAGE' | 'FIXED_MINOR'; percentageBps: number | null; fixedDiscountMinor: bigint | null; maximumDiscountMinor: bigint | null; currency: string; minimumEligibleSubtotalMinor: bigint | null; maximumRedemptions: number | null; maximumRedemptionsPerUser: number | null; isActive: boolean; startsAt: Date | null; endsAt: Date | null; productIds: string[]; categoryIds: string[] };
export type CouponResult = { coupon: CouponConfig; discountMinor: bigint; lineDiscounts: Map<string, bigint>; eligibleSubtotalMinor: bigint };

export const normalizeCouponCode = (value: string): string => value.trim().toUpperCase();
export const couponIneligible = (): never => { throw new AppError(422, 'COUPON_INELIGIBLE', 'The coupon is not available for this checkout.'); };

/** Allocates whole minor units by proportional largest remainder, breaking ties by immutable variant id. */
export function allocateCouponDiscount(lines: CouponLine[], discountMinor: bigint): Map<string, bigint> {
  const total = lines.reduce((sum, line) => sum + line.grossMinor, 0n);
  if (discountMinor < 0n || discountMinor > total || total === 0n) throw new Error('Invalid coupon allocation.');
  const allocations = new Map(lines.map((line) => [line.productVariantId, 0n]));
  const parts = lines.map((line) => ({ line, quotient: (discountMinor * line.grossMinor) / total, remainder: (discountMinor * line.grossMinor) % total }));
  let distributed = 0n;
  for (const part of parts) { allocations.set(part.line.productVariantId, part.quotient); distributed += part.quotient; }
  let remaining = discountMinor - distributed;
  for (const part of parts.sort((a, b) => a.remainder === b.remainder ? a.line.productVariantId.localeCompare(b.line.productVariantId) : a.remainder > b.remainder ? -1 : 1)) {
    if (remaining === 0n) break;
    allocations.set(part.line.productVariantId, (allocations.get(part.line.productVariantId) ?? 0n) + 1n);
    remaining -= 1n;
  }
  return allocations;
}

export function calculateCoupon(config: CouponConfig, lines: CouponLine[], currency: string, now = new Date()): CouponResult {
  if (!config.isActive || (config.startsAt && config.startsAt > now) || (config.endsAt && config.endsAt <= now) || config.currency !== currency) couponIneligible();
  const targeted = config.productIds.length > 0 || config.categoryIds.length > 0;
  const productIds = new Set(config.productIds); const categoryIds = new Set(config.categoryIds);
  const eligible = lines.filter((line) => !targeted || productIds.has(line.productId) || line.categoryIds.some((id) => categoryIds.has(id)));
  const eligibleSubtotalMinor = eligible.reduce((sum, line) => sum + line.grossMinor, 0n);
  if (eligible.length === 0 || (config.minimumEligibleSubtotalMinor !== null && eligibleSubtotalMinor < config.minimumEligibleSubtotalMinor)) couponIneligible();
  let discountMinor: bigint;
  if (config.discountType === 'PERCENTAGE') {
    const percentageBps = config.percentageBps;
    if (percentageBps === null || percentageBps < 1 || percentageBps > 10000) couponIneligible();
    discountMinor = (eligibleSubtotalMinor * BigInt(percentageBps ?? 0)) / 10000n;
    if (config.maximumDiscountMinor !== null && discountMinor > config.maximumDiscountMinor) discountMinor = config.maximumDiscountMinor;
  } else {
    const fixedDiscountMinor = config.fixedDiscountMinor;
    if (fixedDiscountMinor === null || fixedDiscountMinor <= 0n) couponIneligible();
    discountMinor = fixedDiscountMinor ?? 0n;
  }
  discountMinor = discountMinor > eligibleSubtotalMinor ? eligibleSubtotalMinor : discountMinor;
  if (discountMinor <= 0n) couponIneligible();
  return { coupon: config, discountMinor, lineDiscounts: allocateCouponDiscount(eligible, discountMinor), eligibleSubtotalMinor };
}
