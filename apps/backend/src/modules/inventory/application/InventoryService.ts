import { AppError } from '../../../shared/domain/AppError.js';
import type { InventoryRepository } from '../domain/InventoryRepository.js';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}
  list(userId: string) { return this.repository.listForUser(userId); }
  async adjust(userId: string, input: { warehouseId: string; productVariantId: string; quantityDelta: number; referenceKey: string }) {
    const warehouse = await this.repository.findWarehouseContext(userId, input.warehouseId);
    if (!warehouse) throw new AppError(404, 'NOT_FOUND', 'Warehouse not found.');
    if (warehouse.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this warehouse.');
    if (warehouse.verificationStatus !== 'VERIFIED') throw new AppError(403, 'SELLER_NOT_VERIFIED', 'Your seller profile must be verified before adjusting inventory.');
    if (warehouse.storeStatus === 'ARCHIVED') throw new AppError(409, 'INVALID_STATE', 'Archived stores cannot have inventory adjustments.');
    return this.repository.adjust({ ...input, userId });
  }
}
