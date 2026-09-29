-- Milestone B: enforce invariants already required by the application.
-- This forward migration intentionally leaves 0_init unchanged.
BEGIN;

ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_weight_positive" CHECK ("weightGrams" IS NULL OR "weightGrams" > 0);
ALTER TABLE "ProductVariantPrice" ADD CONSTRAINT "ProductVariantPrice_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_unit_price_nonnegative" CHECK ("unitPriceMinor" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_quantities_nonnegative" CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "shippingMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_nonnegative" CHECK ("unitPriceMinor" >= 0 AND "discountMinor" >= 0 AND "taxMinor" >= 0 AND "lineTotalMinor" >= 0);
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_nonnegative" CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "shippingMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_amounts_nonnegative" CHECK ("unitPriceMinor" >= 0 AND "lineTotalMinor" >= 0);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts_nonnegative" CHECK ("attempts" >= 0 AND "version" >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_quantities_nonnegative" CHECK ("onHandQty" >= 0 AND "reservedQty" >= 0 AND "reorderPoint" >= 0 AND "reservedQty" <= "onHandQty" AND "version" >= 0);

COMMIT;
