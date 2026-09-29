import { AppError } from '../../../shared/domain/AppError.js';
import type { CatalogRepository, ProductCreateInput, ProductQuery, ProductUpdateInput } from '../domain/CatalogRepository.js';

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listCategories() { return this.repository.listCategories(); }
  async getCategory(slug: string) { const category = await this.repository.findActiveCategoryBySlug(slug); if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found.'); return category; }
  listBrands() { return this.repository.listBrands(); }
  async getBrand(slug: string) { const brand = await this.repository.findBrandBySlug(slug); if (!brand) throw new AppError(404, 'NOT_FOUND', 'Brand not found.'); return brand; }
  listProducts(query: ProductQuery) { return this.repository.listPublicProducts(query); }
  async getProduct(identifier: string) { const product = await this.repository.findPublicProduct(identifier); if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.'); return product; }
  async listStoreProducts(slug: string, query: ProductQuery) { return this.repository.listPublicProducts({ ...query, store: slug }); }
  listSellerProducts(userId: string) { return this.repository.listSellerProducts(userId); }
  async createProduct(userId: string, input: ProductCreateInput) { await this.assertVerifiedStoreOwner(userId, input.storeId); return this.repository.createProduct(input); }
  async updateProduct(userId: string, productId: string, input: ProductUpdateInput) { await this.assertProductOwner(userId, productId); return this.repository.updateProduct(productId, input); }
  async archiveProduct(userId: string, productId: string) { await this.assertProductOwner(userId, productId); return this.repository.archiveProduct(productId); }
  async addProductImage(userId: string, productId: string, input: { variantId?: string; storageKey: string; altText?: string; position: number }) { await this.assertProductOwner(userId, productId); return this.repository.createProductImage({ productId, ...input }); }

  private async assertVerifiedStoreOwner(userId: string, storeId: string): Promise<void> {
    const store = await this.repository.findStoreOwner(storeId);
    if (!store) throw new AppError(404, 'NOT_FOUND', 'Store not found.');
    if (store.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this store.');
    if (store.verificationStatus !== 'VERIFIED' || store.status !== 'ACTIVE') throw new AppError(403, 'INVALID_STORE_STATE', 'Your store must be active and seller profile verified before adding products.');
  }

  private async assertProductOwner(userId: string, productId: string): Promise<void> {
    const product = await this.repository.findProductOwner(productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
    if (product.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this product.');
  }
}
