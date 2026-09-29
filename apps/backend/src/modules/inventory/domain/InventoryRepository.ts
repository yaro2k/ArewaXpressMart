export interface InventoryRepository {
  listForUser(userId: string): Promise<unknown[]>;
  findWarehouseContext(userId: string, warehouseId: string): Promise<{ userId: string; verificationStatus: string; storeStatus: string } | null>;
  adjust(input: { userId: string; warehouseId: string; productVariantId: string; quantityDelta: number; referenceKey: string }): Promise<unknown>;
}
