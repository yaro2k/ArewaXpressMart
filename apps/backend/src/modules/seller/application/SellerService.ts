import { AppError } from '../../../shared/domain/AppError.js';
import type { SellerRepository, Store, Warehouse } from '../domain/SellerRepository.js';

export class SellerService {
  constructor(private readonly repository: SellerRepository) {}
  async apply(userId: string, input: { legalName: string; businessRegistration?: string }) { return this.repository.createProfile({ userId, ...input }); }
  async getProfile(userId: string) { const profile = await this.repository.findProfileByUserId(userId); if (!profile) throw new AppError(404, 'NOT_FOUND', 'Seller profile not found.'); return profile; }
  async updateProfile(userId: string, input: { legalName?: string; businessRegistration?: string | null }) { await this.getProfile(userId); return this.repository.updateProfile(userId, input); }
  async listStores(userId: string) { await this.getProfile(userId); return this.repository.findStoresByUserId(userId); }
  async createStore(userId: string, input: { slug: string; displayName: string; description?: string }) { const profile = await this.getProfile(userId); if (profile.verificationStatus !== 'VERIFIED') throw new AppError(403, 'SELLER_NOT_VERIFIED', 'Your seller profile must be verified before creating a store.'); return this.repository.createStore({ sellerProfileId: profile.id, ...input }); }
  async updateStore(userId: string, storeId: string, input: { displayName?: string; description?: string | null }) { const store = await this.assertStoreOwner(userId, storeId); if (store.status === 'ARCHIVED') throw new AppError(409, 'INVALID_STATE', 'Archived stores cannot be changed.'); return this.repository.updateStore(storeId, input); }
  async listWarehouses(userId: string) { await this.getProfile(userId); return this.repository.findWarehousesByUserId(userId); }
  async createWarehouse(userId: string, input: { storeId: string; code: string; name: string }) {
    const profile = await this.getProfile(userId);
    if (profile.verificationStatus !== 'VERIFIED') throw new AppError(403, 'SELLER_NOT_VERIFIED', 'Your seller profile must be verified before creating a warehouse.');
    const store = await this.assertStoreOwner(userId, input.storeId);
    if (store.status === 'ARCHIVED') throw new AppError(409, 'INVALID_STATE', 'Archived stores cannot have warehouses.');
    return this.repository.createWarehouse(input);
  }
  async updateWarehouse(userId: string, warehouseId: string, input: { name?: string; isActive?: boolean }) { await this.assertWarehouseOwner(userId, warehouseId); return this.repository.updateWarehouse(warehouseId, input); }
  async getPublicStore(slug: string): Promise<Store> { const store = await this.repository.findPublicStoreBySlug(slug); if (!store) throw new AppError(404, 'NOT_FOUND', 'Store not found.'); return store; }
  private async assertStoreOwner(userId: string, storeId: string): Promise<Store> { const store = await this.repository.findStoreById(storeId); if (!store) throw new AppError(404, 'NOT_FOUND', 'Store not found.'); const profile = await this.getProfile(userId); if (store.sellerProfileId !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You do not own this store.'); return store; }
  private async assertWarehouseOwner(userId: string, warehouseId: string): Promise<Warehouse> { const warehouse = await this.repository.findWarehouseById(warehouseId); if (!warehouse) throw new AppError(404, 'NOT_FOUND', 'Warehouse not found.'); await this.assertStoreOwner(userId, warehouse.storeId); return warehouse; }
}
