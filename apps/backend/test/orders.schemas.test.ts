import { describe, expect, it } from 'vitest';
import { shipmentCreateSchema, shipmentStatusSchema } from '../src/modules/orders/presentation/orders.schemas.js';
const id = '550e8400-e29b-41d4-a716-446655440000';
describe('orders request validation', () => {
  it('accepts a bounded shipment request', () => { expect(shipmentCreateSchema.parse({ orderId: id, warehouseId: id, shippingMethodId: id, items: [{ orderItemId: id, quantity: 1 }], trackingNumber: 'TRK-1' }).items).toHaveLength(1); });
  it('allows only protected shipment states', () => { expect(shipmentStatusSchema.parse({ status: 'DELIVERED' }).status).toBe('DELIVERED'); expect(() => shipmentStatusSchema.parse({ status: 'PAID' })).toThrow(); });
});
