CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_MINOR');
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

CREATE TABLE "Coupon" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" "CouponDiscountType" NOT NULL,
  "percentageBps" INTEGER,
  "fixedDiscountMinor" BIGINT,
  "maximumDiscountMinor" BIGINT,
  "currency" CHAR(3) NOT NULL,
  "minimumEligibleSubtotalMinor" BIGINT,
  "maximumRedemptions" INTEGER,
  "maximumRedemptionsPerUser" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Coupon_code_key" UNIQUE ("code"),
  CONSTRAINT "coupon_configuration_valid" CHECK (
    ("discountType" = 'PERCENTAGE' AND "percentageBps" BETWEEN 1 AND 10000 AND "fixedDiscountMinor" IS NULL AND ("maximumDiscountMinor" IS NULL OR "maximumDiscountMinor" >= 0))
    OR
    ("discountType" = 'FIXED_MINOR' AND "fixedDiscountMinor" > 0 AND "percentageBps" IS NULL AND "maximumDiscountMinor" IS NULL)
  ),
  CONSTRAINT "coupon_limits_valid" CHECK (("minimumEligibleSubtotalMinor" IS NULL OR "minimumEligibleSubtotalMinor" >= 0) AND ("maximumRedemptions" IS NULL OR "maximumRedemptions" > 0) AND ("maximumRedemptionsPerUser" IS NULL OR "maximumRedemptionsPerUser" > 0) AND ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt"))
);

CREATE TABLE "CouponProduct" (
  "couponId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId", "productId"),
  CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CouponCategory" (
  "couponId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId", "categoryId"),
  CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL,
  "couponId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "couponCode" TEXT NOT NULL,
  "discountType" "CouponDiscountType" NOT NULL,
  "percentageBps" INTEGER,
  "fixedDiscountMinor" BIGINT,
  "maximumDiscountMinor" BIGINT,
  "discountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "coupon_redemption_amount_valid" CHECK ("discountMinor" > 0),
  CONSTRAINT "coupon_redemption_lifecycle_valid" CHECK (("status" = 'RESERVED' AND "redeemedAt" IS NULL AND "releasedAt" IS NULL) OR ("status" = 'REDEEMED' AND "redeemedAt" IS NOT NULL AND "releasedAt" IS NULL) OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "redeemedAt" IS NULL))
);

ALTER TABLE "InvoiceItem" ADD COLUMN "discountMinor" BIGINT NOT NULL DEFAULT 0;

CREATE INDEX "Coupon_isActive_startsAt_endsAt_idx" ON "Coupon"("isActive", "startsAt", "endsAt");
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");
CREATE INDEX "CouponRedemption_couponId_userId_status_idx" ON "CouponRedemption"("couponId", "userId", "status");
CREATE INDEX "CouponRedemption_userId_reservedAt_idx" ON "CouponRedemption"("userId", "reservedAt");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
