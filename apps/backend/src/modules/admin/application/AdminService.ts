import { AppError } from '../../../shared/domain/AppError.js';
import type { AdminRepository } from '../domain/AdminRepository.js';
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}
  listCategories() { return this.repository.listCategories(); }
  async getCategory(id: string) { const value = await this.repository.getCategory(id); if (!value) throw new AppError(404, 'NOT_FOUND', 'Category not found.'); return value; }
  createCategory(actorId: string, input: { name: string; slug: string; parentCategoryId?: string | null }) { return this.repository.createCategory(actorId, input); }
  updateCategory(actorId: string, id: string, input: { name?: string; slug?: string; parentCategoryId?: string | null; isActive?: boolean }) { return this.repository.updateCategory(actorId, id, input); }
  listBrands() { return this.repository.listBrands(); }
  async getBrand(id: string) { const value = await this.repository.getBrand(id); if (!value) throw new AppError(404, 'NOT_FOUND', 'Brand not found.'); return value; }
  createBrand(actorId: string, input: { name: string; slug: string; description?: string | null }) { return this.repository.createBrand(actorId, input); }
  updateBrand(actorId: string, id: string, input: { name?: string; slug?: string; description?: string | null }) { return this.repository.updateBrand(actorId, id, input); }
  listUsers() { return this.repository.listUsers(); }
  async updateUserStatus(actorId: string, userId: string, status: string, reason: string) { if (actorId === userId && ['SUSPENDED', 'DEACTIVATED'].includes(status)) throw new AppError(409, 'INVALID_STATE', 'An administrator cannot disable their own account.'); return this.repository.updateUserStatus(actorId, userId, status, reason); }
  async replaceUserRoles(actorId: string, userId: string, roleCodes: string[]) { if (actorId === userId && !roleCodes.includes('ADMIN')) throw new AppError(409, 'INVALID_STATE', 'An administrator cannot remove their own ADMIN role.'); return this.repository.replaceUserRoles(actorId, userId, roleCodes); }
  listSellerApplications() { return this.repository.listSellerApplications(); }
  updateSellerApplication(actorId: string, sellerId: string, status: string, reason?: string) { return this.repository.updateSellerApplication(actorId, sellerId, status, reason); }
  moderateProduct(actorId: string, productId: string, status: string, reason?: string) { return this.repository.moderateProduct(actorId, productId, status, reason); }
  listAuditLogs() { return this.repository.listAuditLogs(); }
  listShippingCarriers() { return this.repository.listShippingCarriers(); }
  createShippingCarrier(actorId: string, input: { name: string; trackingUrlTemplate?: string | null; isActive?: boolean }) { return this.repository.createShippingCarrier(actorId, input); }
  updateShippingCarrier(actorId: string, id: string, input: { name?: string; trackingUrlTemplate?: string | null; isActive?: boolean }) { return this.repository.updateShippingCarrier(actorId, id, input); }
  listShippingMethods() { return this.repository.listShippingMethods(); }
  createShippingMethod(actorId: string, input: { carrierId: string; code: string; name: string; serviceLevel: string; isActive?: boolean }) { return this.repository.createShippingMethod(actorId, input); }
  updateShippingMethod(actorId: string, id: string, input: { code?: string; name?: string; serviceLevel?: string; isActive?: boolean }) { return this.repository.updateShippingMethod(actorId, id, input); }
  listShippingRates() { return this.repository.listShippingRates(); }
  createShippingRate(actorId: string, input: { storeId: string; shippingMethodId: string; cityId: string; amountMinor: number; currency: string; isActive?: boolean }) { return this.repository.createShippingRate(actorId, input); }
  updateShippingRate(actorId: string, id: string, input: { amountMinor?: number; currency?: string; isActive?: boolean }) { return this.repository.updateShippingRate(actorId, id, input); }
}
