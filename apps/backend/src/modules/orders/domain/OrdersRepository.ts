export interface ShipmentInput { orderId: string; warehouseId: string; shippingMethodId: string; items: Array<{ orderItemId: string; quantity: number }>; idempotencyKey: string; trackingNumber?: string; }
export interface ShipmentStatusInput { status: 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; location?: string; details?: string; }
export interface OrdersRepository {
  listCustomerOrders(userId: string): Promise<unknown[]>;
  findCustomerOrder(userId: string, orderId: string): Promise<unknown | null>;
  cancelOrder(userId: string, orderId: string, reason?: string): Promise<unknown>;
  listSellerOrderItems(userId: string): Promise<unknown[]>;
  listCustomerShipments(userId: string, orderId: string): Promise<unknown[]>;
  createShipment(userId: string, input: ShipmentInput): Promise<unknown>;
  updateShipmentStatus(userId: string, shipmentId: string, input: ShipmentStatusInput): Promise<unknown>;
}
