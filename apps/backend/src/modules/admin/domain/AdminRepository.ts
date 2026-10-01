export interface AdminRepository {
  listCategories(): Promise<unknown[]>;
  getCategory(categoryId: string): Promise<unknown | null>;
  createCategory(actorId: string, input: { name: string; slug: string; parentCategoryId?: string | null }): Promise<unknown>;
  updateCategory(actorId: string, categoryId: string, input: { name?: string; slug?: string; parentCategoryId?: string | null; isActive?: boolean }): Promise<unknown>;
  listBrands(): Promise<unknown[]>;
  getBrand(brandId: string): Promise<unknown | null>;
  createBrand(actorId: string, input: { name: string; slug: string; description?: string | null }): Promise<unknown>;
  updateBrand(actorId: string, brandId: string, input: { name?: string; slug?: string; description?: string | null }): Promise<unknown>;
  listUsers(): Promise<unknown[]>;
  updateUserStatus(actorId: string, userId: string, status: string, reason: string): Promise<unknown>;
  replaceUserRoles(actorId: string, userId: string, roleCodes: string[]): Promise<unknown>;
  listSellerApplications(): Promise<unknown[]>;
  updateSellerApplication(actorId: string, sellerId: string, status: string, reason?: string): Promise<unknown>;
  moderateProduct(actorId: string, productId: string, status: string, reason?: string): Promise<unknown>;
  listAuditLogs(): Promise<unknown[]>;
  listShippingCarriers(): Promise<unknown[]>;
  createShippingCarrier(actorId: string, input: { name: string; trackingUrlTemplate?: string | null; isActive?: boolean }): Promise<unknown>;
  updateShippingCarrier(actorId: string, carrierId: string, input: { name?: string; trackingUrlTemplate?: string | null; isActive?: boolean }): Promise<unknown>;
  listShippingMethods(): Promise<unknown[]>;
  createShippingMethod(actorId: string, input: { carrierId: string; code: string; name: string; serviceLevel: string; isActive?: boolean }): Promise<unknown>;
  updateShippingMethod(actorId: string, methodId: string, input: { code?: string; name?: string; serviceLevel?: string; isActive?: boolean }): Promise<unknown>;
  listShippingRates(): Promise<unknown[]>;
  createShippingRate(actorId: string, input: { storeId: string; shippingMethodId: string; cityId: string; amountMinor: number; currency: string; isActive?: boolean }): Promise<unknown>;
  updateShippingRate(actorId: string, rateId: string, input: { amountMinor?: number; currency?: string; isActive?: boolean }): Promise<unknown>;
}
