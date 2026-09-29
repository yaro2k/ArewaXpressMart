export interface ProductCreateInput {
  storeId: string; brandId?: string; name: string; slug: string; description: string; categoryIds: string[];
  options: Array<{ name: string; values: string[] }>;
  variants: Array<{ sku: string; barcode?: string; weightGrams?: number; attributes: Record<string, string>; price: { amountMinor: number; currency: string } }>;
  images?: Array<{ storageKey: string; altText?: string; position: number }>;
}
export interface ProductUpdateInput { brandId?: string | null; name?: string; description?: string; categoryIds?: string[]; }
export interface ProductQuery { q?: string; category?: string; brand?: string; store?: string; minPrice?: number; maxPrice?: number; limit: number; }
export interface CatalogRepository {
  listCategories(): Promise<unknown[]>; findActiveCategoryBySlug(slug: string): Promise<unknown | null>; listBrands(): Promise<unknown[]>; findBrandBySlug(slug: string): Promise<unknown | null>; listPublicProducts(query: ProductQuery): Promise<unknown[]>; findPublicProduct(identifier: string): Promise<unknown | null>; listSellerProducts(userId: string): Promise<unknown[]>;
  findStoreOwner(storeId: string): Promise<{ userId: string; verificationStatus: string; status: string } | null>; findProductOwner(productId: string): Promise<{ userId: string } | null>;
  createProduct(input: ProductCreateInput): Promise<unknown>; updateProduct(productId: string, input: ProductUpdateInput): Promise<unknown>; archiveProduct(productId: string): Promise<void>; createProductImage(input: { productId: string; variantId?: string; storageKey: string; altText?: string; position: number }): Promise<unknown>;
}
