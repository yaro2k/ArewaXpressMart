import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { InventoryRepository } from '../domain/InventoryRepository.js';

const inventoryInclude = { warehouse: { include: { store: true } }, productVariant: { include: { product: true } } } satisfies Prisma.InventoryInclude;
const movementInclude = { type: true } satisfies Prisma.InventoryMovementInclude;
function mapInventory(row: Prisma.InventoryGetPayload<{ include: typeof inventoryInclude }>) { return { id: row.id, warehouse: { id: row.warehouse.id, code: row.warehouse.code, name: row.warehouse.name, storeId: row.warehouse.storeId }, productVariant: { id: row.productVariant.id, sku: row.productVariant.sku, productId: row.productVariant.productId, productName: row.productVariant.product.name }, onHandQty: row.onHandQty, reservedQty: row.reservedQty, availableQty: row.onHandQty - row.reservedQty, reorderPoint: row.reorderPoint, version: row.version }; }
function mapMovement(row: Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>, inventory: { id: string; onHandQty: number; reservedQty: number; version: number }) { return { id: row.id, inventoryId: row.inventoryId, type: row.type.code, quantityDelta: row.quantityDelta, referenceKey: row.referenceKey, referenceType: row.referenceType, referenceId: row.referenceId, occurredAt: row.occurredAt.toISOString(), balance: { onHandQty: inventory.onHandQty, reservedQty: inventory.reservedQty, availableQty: inventory.onHandQty - inventory.reservedQty, version: inventory.version } }; }

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly db: PrismaClient) {}
  async listForUser(userId: string): Promise<unknown[]> { const rows = await this.db.inventory.findMany({ where: { warehouse: { store: { sellerProfile: { userId } } } }, include: inventoryInclude, orderBy: [{ warehouseId: 'asc' }, { productVariantId: 'asc' }] }); return rows.map(mapInventory); }
  async findWarehouseContext(userId: string, warehouseId: string) { const warehouse = await this.db.warehouse.findUnique({ where: { id: warehouseId }, include: { store: { include: { sellerProfile: { include: { verificationStatus: true } }, status: true } } } }); return warehouse ? { userId: warehouse.store.sellerProfile.userId, verificationStatus: warehouse.store.sellerProfile.verificationStatus.code, storeStatus: warehouse.store.status.code } : null; }
  async adjust(input: { userId: string; warehouseId: string; productVariantId: string; quantityDelta: number; referenceKey: string }): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId }, select: { storeId: true } });
      const variant = await tx.productVariant.findUnique({ where: { id: input.productVariantId }, select: { product: { select: { storeId: true } } } });
      if (!warehouse || !variant || warehouse.storeId !== variant.product.storeId) throw new AppError(400, 'INVALID_VARIANT', 'Product variant does not belong to this warehouse store.');
      const type = await tx.inventoryMovementType.findUniqueOrThrow({ where: { code: 'ADJUSTMENT' } });
      const existing = await tx.inventoryMovement.findUnique({ where: { referenceKey: input.referenceKey }, include: movementInclude });
      if (existing) { const balance = await tx.inventory.findUniqueOrThrow({ where: { id: existing.inventoryId }, select: { id: true, onHandQty: true, reservedQty: true, version: true } }); return mapMovement(existing, balance); }
      const inventory = await tx.inventory.upsert({ where: { warehouseId_productVariantId: { warehouseId: input.warehouseId, productVariantId: input.productVariantId } }, create: { warehouseId: input.warehouseId, productVariantId: input.productVariantId }, update: {} });
      const updated = await tx.inventory.updateMany({ where: { id: inventory.id, version: inventory.version, onHandQty: { gte: input.quantityDelta < 0 ? -input.quantityDelta : 0 } }, data: { onHandQty: { increment: input.quantityDelta }, version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, 'INVENTORY_CONFLICT', 'Inventory changed; retry the adjustment.');
      const balance = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id }, select: { id: true, onHandQty: true, reservedQty: true, version: true } });
      if (balance.onHandQty < balance.reservedQty) throw new AppError(422, 'INSUFFICIENT_INVENTORY', 'Adjustment would make available stock negative.');
      const movement = await tx.inventoryMovement.create({ data: { inventoryId: inventory.id, typeId: type.id, quantityDelta: input.quantityDelta, referenceKey: input.referenceKey, referenceType: 'MANUAL_ADJUSTMENT' }, include: movementInclude });
      return mapMovement(movement, balance);
    });
  }
}
