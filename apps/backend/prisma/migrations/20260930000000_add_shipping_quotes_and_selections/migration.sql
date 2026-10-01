BEGIN;

ALTER TABLE "ShippingCarrier" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ShippingRate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL,
  "shippingMethodId" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShippingRate_amount_nonnegative" CHECK ("amountMinor" >= 0)
);

CREATE TABLE "OrderShippingSelection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "shippingMethodId" UUID NOT NULL,
  "carrierName" TEXT NOT NULL,
  "methodCode" TEXT NOT NULL,
  "methodName" TEXT NOT NULL,
  "serviceLevel" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderShippingSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderShippingSelection_amount_nonnegative" CHECK ("amountMinor" >= 0)
);

ALTER TABLE "Shipment" ADD COLUMN "orderShippingSelectionId" UUID;

CREATE UNIQUE INDEX "ShippingRate_storeId_shippingMethodId_cityId_key" ON "ShippingRate"("storeId", "shippingMethodId", "cityId");
CREATE INDEX "ShippingRate_storeId_cityId_isActive_idx" ON "ShippingRate"("storeId", "cityId", "isActive");
CREATE INDEX "ShippingRate_shippingMethodId_idx" ON "ShippingRate"("shippingMethodId");
CREATE INDEX "ShippingRate_cityId_idx" ON "ShippingRate"("cityId");
CREATE UNIQUE INDEX "OrderShippingSelection_orderId_storeId_key" ON "OrderShippingSelection"("orderId", "storeId");
CREATE INDEX "OrderShippingSelection_storeId_idx" ON "OrderShippingSelection"("storeId");
CREATE INDEX "OrderShippingSelection_shippingMethodId_idx" ON "OrderShippingSelection"("shippingMethodId");
CREATE INDEX "Shipment_orderShippingSelectionId_idx" ON "Shipment"("orderShippingSelectionId");

ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderShippingSelection" ADD CONSTRAINT "OrderShippingSelection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderShippingSelection" ADD CONSTRAINT "OrderShippingSelection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderShippingSelection" ADD CONSTRAINT "OrderShippingSelection_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderShippingSelectionId_fkey" FOREIGN KEY ("orderShippingSelectionId") REFERENCES "OrderShippingSelection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
