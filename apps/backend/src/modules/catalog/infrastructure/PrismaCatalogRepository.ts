import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { CatalogRepository, ProductCreateInput, ProductQuery, ProductUpdateInput } from '../domain/CatalogRepository.js';

const productInclude = {
  store: true, brand: true, status: true, categories: { include: { category: true } },
  options: { orderBy: { position: 'asc' as const }, include: { values: { orderBy: { position: 'asc' as const } } } },
  variants: { where: { isActive: true }, include: { optionValues: { include: { optionValue: { include: { option: true } } } }, prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' as const }, take: 1 } }, orderBy: { createdAt: 'asc' as const } },
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

function mapProduct(product: any) {
  return {
    id: product.id, name: product.name, slug: product.slug, description: product.description, status: product.status.code,
    store: { id: product.store.id, slug: product.store.slug, displayName: product.store.displayName },
    brand: product.brand ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug } : null,
    categories: product.categories.map(({ category }: any) => ({ id: category.id, name: category.name, slug: category.slug })),
    options: product.options.map((option: any) => ({ name: option.name, values: option.values.map((value: any) => value.value) })),
    variants: product.variants.map((variant: any) => ({ id: variant.id, sku: variant.sku, barcode: variant.barcode, weightGrams: variant.weightGrams, attributes: Object.fromEntries(variant.optionValues.map(({ optionValue }: any) => [optionValue.option.name, optionValue.value])), price: variant.prices[0] ? { amountMinor: Number(variant.prices[0].amountMinor), currency: variant.prices[0].currency } : null })),
    images: product.images.map((image: any) => ({ id: image.id, storageKey: image.storageKey, altText: image.altText, position: image.position, variantId: image.variantId })),
    createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString(),
  };
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCategories(): Promise<unknown[]> { return this.db.category.findMany({ where: { isActive: true }, orderBy: [{ parentCategoryId: 'asc' }, { name: 'asc' }] }).then((rows) => rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, parentCategoryId: row.parentCategoryId }))); }
  async findActiveCategoryBySlug(slug: string): Promise<unknown | null> { const category = await this.db.category.findFirst({ where: { slug, isActive: true } }); return category ? { id: category.id, name: category.name, slug: category.slug, parentCategoryId: category.parentCategoryId } : null; }
  async listBrands(): Promise<unknown[]> { return this.db.brand.findMany({ orderBy: { name: 'asc' } }).then((rows) => rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description }))); }
  async findBrandBySlug(slug: string): Promise<unknown | null> { const brand = await this.db.brand.findUnique({ where: { slug } }); return brand ? { id: brand.id, name: brand.name, slug: brand.slug, description: brand.description } : null; }
  async listPublicProducts(query: ProductQuery): Promise<unknown[]> {
    const prices: Prisma.ProductVariantPriceWhereInput = {};
    if (query.minPrice !== undefined) prices.amountMinor = { gte: BigInt(query.minPrice) };
    if (query.maxPrice !== undefined) prices.amountMinor = { ...(typeof prices.amountMinor === 'object' && prices.amountMinor !== null ? prices.amountMinor : {}), lte: BigInt(query.maxPrice) };
    const products = await this.db.product.findMany({
      where: { status: { code: 'ACTIVE' }, store: { status: { code: 'ACTIVE' } }, ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}), ...(query.category ? { categories: { some: { category: { slug: query.category, isActive: true } } } } : {}), ...(query.brand ? { brand: { slug: query.brand } } : {}), ...(query.store ? { store: { slug: query.store, status: { code: 'ACTIVE' } } } : {}), ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { variants: { some: { isActive: true, prices: { some: { endsAt: null, ...prices } } } } } : {}) },
      include: productInclude, orderBy: { createdAt: 'desc' }, take: query.limit,
    });
    return products.map(mapProduct);
  }
  async findPublicProduct(identifier: string): Promise<unknown | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const product = await this.db.product.findFirst({ where: { status: { code: 'ACTIVE' }, store: { status: { code: 'ACTIVE' } }, OR: isUuid ? [{ id: identifier }, { slug: identifier }] : [{ slug: identifier }] }, include: productInclude });
    return product ? mapProduct(product) : null;
  }
  async listSellerProducts(userId: string): Promise<unknown[]> { const products = await this.db.product.findMany({ where: { store: { sellerProfile: { userId } } }, include: productInclude, orderBy: { updatedAt: 'desc' } }); return products.map(mapProduct); }
  async findStoreOwner(storeId: string) { const store = await this.db.store.findUnique({ where: { id: storeId }, include: { status: true, sellerProfile: { include: { verificationStatus: true } } } }); return store ? { userId: store.sellerProfile.userId, verificationStatus: store.sellerProfile.verificationStatus.code, status: store.status.code } : null; }
  async findProductOwner(productId: string) { const product = await this.db.product.findUnique({ where: { id: productId }, select: { store: { select: { sellerProfile: { select: { userId: true } } } } } }); return product ? { userId: product.store.sellerProfile.userId } : null; }
  async createProduct(input: ProductCreateInput): Promise<unknown> {
    try {
      return await this.db.$transaction(async (tx) => {
        const categories = await tx.category.findMany({ where: { id: { in: input.categoryIds }, isActive: true }, select: { id: true } });
        if (categories.length !== input.categoryIds.length) throw new AppError(400, 'INVALID_CATEGORY', 'One or more categories do not exist or are inactive.');
        if (input.brandId && !await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })) throw new AppError(400, 'INVALID_BRAND', 'Brand not found.');
        const draftStatus = await tx.productStatus.findUniqueOrThrow({ where: { code: 'DRAFT' }, select: { id: true } });
        const product = await tx.product.create({ data: { storeId: input.storeId, brandId: input.brandId, name: input.name, slug: input.slug.toLowerCase(), description: input.description, statusId: draftStatus.id, categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) }, images: input.images ? { create: input.images } : undefined } });
        const optionIds = new Map<string, Map<string, string>>();
        for (const [position, option] of input.options.entries()) { const created = await tx.productOption.create({ data: { productId: product.id, name: option.name, position, values: { create: option.values.map((value, valuePosition) => ({ value, position: valuePosition })) }, }, include: { values: true } }); optionIds.set(option.name.toLowerCase(), new Map(created.values.map((value) => [value.value.toLowerCase(), value.id]))); }
        for (const variant of input.variants) {
          const attributes = Object.entries(variant.attributes);
          if (attributes.length !== input.options.length || attributes.some(([name, value]) => !optionIds.get(name.toLowerCase())?.has(value.toLowerCase()))) throw new AppError(400, 'INVALID_VARIANT_ATTRIBUTES', 'Each variant must select exactly one value for every product option.');
          await tx.productVariant.create({ data: { productId: product.id, sku: variant.sku, barcode: variant.barcode, weightGrams: variant.weightGrams, optionValues: { create: attributes.map(([name, value]) => ({ optionValueId: optionIds.get(name.toLowerCase())!.get(value.toLowerCase())! })) }, prices: { create: { currency: variant.price.currency, amountMinor: BigInt(variant.price.amountMinor) } } } });
        }
        const result = await tx.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
        return mapProduct(result);
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'A product slug, SKU, or barcode is already in use.'); throw error; }
  }
  async updateProduct(productId: string, input: ProductUpdateInput): Promise<unknown> {
    if (input.brandId && !await this.db.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })) throw new AppError(400, 'INVALID_BRAND', 'Brand not found.');
    if (input.categoryIds) { const categories = await this.db.category.count({ where: { id: { in: input.categoryIds }, isActive: true } }); if (categories !== input.categoryIds.length) throw new AppError(400, 'INVALID_CATEGORY', 'One or more categories do not exist or are inactive.'); }
    const product = await this.db.product.update({ where: { id: productId }, data: { brandId: input.brandId, name: input.name, description: input.description, ...(input.categoryIds ? { categories: { deleteMany: {}, create: input.categoryIds.map((categoryId) => ({ categoryId })) } } : {}) }, include: productInclude });
    return mapProduct(product);
  }
  async archiveProduct(productId: string): Promise<void> { await this.db.product.update({ where: { id: productId }, data: { status: { connect: { code: 'ARCHIVED' } } } }); }
  async createProductImage(input: { productId: string; variantId?: string; storageKey: string; altText?: string; position: number }): Promise<unknown> {
    try {
      return await this.db.$transaction(async (tx) => {
        if (input.variantId && !await tx.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId }, select: { id: true } })) throw new AppError(400, 'INVALID_VARIANT', 'Variant does not belong to this product.');
        return tx.productImage.create({ data: input });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'Image storage key or position is already in use.');
      throw error;
    }
  }
}
