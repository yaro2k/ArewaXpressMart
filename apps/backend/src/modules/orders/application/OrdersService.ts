import type { OrdersRepository, ShipmentInput, ShipmentStatusInput } from '../domain/OrdersRepository.js';
export class OrdersService {
  constructor(private readonly repository: OrdersRepository) {}
  list(userId: string) { return this.repository.listCustomerOrders(userId); }
  get(userId: string, orderId: string) { return this.repository.findCustomerOrder(userId, orderId); }
  cancel(userId: string, orderId: string, reason?: string) { return this.repository.cancelOrder(userId, orderId, reason); }
  listSellerItems(userId: string) { return this.repository.listSellerOrderItems(userId); }
  listShipments(userId: string, orderId: string) { return this.repository.listCustomerShipments(userId, orderId); }
  createShipment(userId: string, input: ShipmentInput) { return this.repository.createShipment(userId, input); }
  updateShipmentStatus(userId: string, shipmentId: string, input: ShipmentStatusInput) { return this.repository.updateShipmentStatus(userId, shipmentId, input); }
}
