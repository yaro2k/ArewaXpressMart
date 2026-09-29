export interface SellerProfile {
  id: string;
  userId: string;
  legalName: string;
  businessRegistration: string | null;
  verificationStatus: string;
}

export interface Store {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  status: string;
  sellerProfileId: string;
}

export interface Warehouse {
  id: string;
  storeId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface SellerRepository {
  createProfile(input: { userId: string; legalName: string; businessRegistration?: string }): Promise<SellerProfile>;
  findProfileByUserId(userId: string): Promise<SellerProfile | null>;
  updateProfile(userId: string, input: { legalName?: string; businessRegistration?: string | null }): Promise<SellerProfile>;
  createStore(input: { sellerProfileId: string; slug: string; displayName: string; description?: string }): Promise<Store>;
  findStoresByUserId(userId: string): Promise<Store[]>;
  findStoreById(id: string): Promise<Store | null>;
  findPublicStoreBySlug(slug: string): Promise<Store | null>;
  updateStore(id: string, input: { displayName?: string; description?: string | null }): Promise<Store>;
  findWarehousesByUserId(userId: string): Promise<Warehouse[]>;
  findWarehouseById(id: string): Promise<Warehouse | null>;
  createWarehouse(input: { storeId: string; code: string; name: string }): Promise<Warehouse>;
  updateWarehouse(id: string, input: { name?: string; isActive?: boolean }): Promise<Warehouse>;
}
