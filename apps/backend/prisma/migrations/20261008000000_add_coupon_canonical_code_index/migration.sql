-- Coupon codes are normalized by the application, and this expression index
-- protects the canonical namespace for any direct or future database writers.
CREATE UNIQUE INDEX "Coupon_code_lower_key" ON "Coupon" (LOWER("code"));
