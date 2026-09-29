BEGIN;

ALTER TABLE "Cart" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Cart" ADD COLUMN "anonymousTokenHash" TEXT;
ALTER TABLE "Cart" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Cart_anonymousTokenHash_key" ON "Cart"("anonymousTokenHash");
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_exactly_one_owner"
  CHECK (("userId" IS NOT NULL AND "anonymousTokenHash" IS NULL AND "expiresAt" IS NULL)
      OR ("userId" IS NULL AND "anonymousTokenHash" IS NOT NULL AND "expiresAt" IS NOT NULL));

COMMIT;
