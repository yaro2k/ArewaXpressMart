import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../src/modules/orders/application/OrdersService.js';
import type { OrdersRepository } from '../src/modules/orders/domain/OrdersRepository.js';
const userId = '550e8400-e29b-41d4-a716-446655440000';
function repository(overrides: Partial<OrdersRepository> = {}): OrdersRepository { return { listCustomerOrders: async () => [], findCustomerOrder: async () => ({ id: 'order-1' }), cancelOrder: async () => ({ id: 'order-1', status: 'CANCELLED' }), listSellerOrderItems: async () => [], listCustomerShipments: async () => [], createShipment: async () => ({ id: 'shipment-1' }), updateShipmentStatus: async () => ({ id: 'shipment-1', status: 'DELIVERED' }), ...overrides }; }
describe('OrdersService', () => {
  it('passes shipment idempotency input to persistence', async () => { const createShipment = vi.fn(async (id: string, input: any) => ({ id, input })); const service = new OrdersService(repository({ createShipment })); const input = { orderId: 'order-1', warehouseId: 'warehouse-1', shippingMethodId: 'method-1', items: [{ orderItemId: 'item-1', quantity: 1 }], idempotencyKey: 'shipment-key-2026-001' }; await expect(service.createShipment(userId, input)).resolves.toMatchObject({ id: userId }); expect(createShipment).toHaveBeenCalledWith(userId, input); });
  it('delegates customer cancellation to the order state machine', async () => { const cancelOrder = vi.fn(async () => ({ status: 'CANCELLED' })); const service = new OrdersService(repository({ cancelOrder })); await expect(service.cancel(userId, 'order-1', 'Customer request')).resolves.toEqual({ status: 'CANCELLED' }); expect(cancelOrder).toHaveBeenCalledWith(userId, 'order-1', 'Customer request'); });
});
