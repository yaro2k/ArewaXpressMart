import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { SellerProfile, SellerRepository, Store, Warehouse } from '../domain/SellerRepository.js';

const profileInclude = { verificationStatus: true } satisfies Prisma.SellerProfileInclude;
const storeInclude = { status: true } satisfies Prisma.StoreInclude;
const mapProfile = (profile: Prisma.SellerProfileGetPayload<{ include: typeof profileInclude }>): SellerProfile => ({ id: profile.id, userId: profile.userId, legalName: profile.legalName, businessRegistration: profile.businessRegistration, verificationStatus: profile.verificationStatus.code });
const mapStore = (store: Prisma.StoreGetPayload<{ include: typeof storeInclude }>): Store => ({ id: store.id, slug: store.slug, displayName: store.displayName, description: store.description, status: store.status.code, sellerProfileId: store.sellerProfileId });
const mapWarehouse = (warehouse: Prisma.WarehouseGetPayload<object>): Warehouse => ({ id: warehouse.id, storeId: warehouse.storeId, code: warehouse.code, name: warehouse.name, isActive: warehouse.isActive });

export class PrismaSellerRepository implements SellerRepository {
  constructor(private readonly db: PrismaClient) {}
  async createProfile(input: { userId: string; legalName: string; businessRegistration?: string }): Promise<SellerProfile> {
    try {
      return await this.db.$transaction(async (tx) => {
        const profile = await tx.sellerProfile.create({ data: { legalName: input.legalName, businessRegistration: input.businessRegistration, user: { connect: { id: input.userId } }, verificationStatus: { connect: { code: 'PENDING' } } }, include: profileInclude });
        const sellerRole = await tx.role.findUniqueOrThrow({ where: { code: 'SELLER' }, select: { id: true } });
        await tx.userRole.upsert({ where: { userId_roleId: { userId: input.userId, roleId: sellerRole.id } }, create: { userId: input.userId, roleId: sellerRole.id }, update: {} });
        return mapProfile(profile);
      });
    }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'A seller application already exists for this account.'); throw error; }
  }
  async findProfileByUserId(userId: string): Promise<SellerProfile | null> { const profile = await this.db.sellerProfile.findUnique({ where: { userId }, include: profileInclude }); return profile ? mapProfile(profile) : null; }
  async updateProfile(userId: string, input: { legalName?: string; businessRegistration?: string | null }): Promise<SellerProfile> { return mapProfile(await this.db.sellerProfile.update({ where: { userId }, data: input, include: profileInclude })); }
  async createStore(input: { sellerProfileId: string; slug: string; displayName: string; description?: string }): Promise<Store> {
    try { return mapStore(await this.db.store.create({ data: { slug: input.slug.toLowerCase(), displayName: input.displayName, description: input.description, sellerProfile: { connect: { id: input.sellerProfileId } }, status: { connect: { code: 'DRAFT' } } }, include: storeInclude })); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'This store slug is already in use.'); throw error; }
  }
  async findStoresByUserId(userId: string): Promise<Store[]> { const stores = await this.db.store.findMany({ where: { sellerProfile: { userId } }, include: storeInclude, orderBy: { createdAt: 'asc' } }); return stores.map(mapStore); }
  async findStoreById(id: string): Promise<Store | null> { const store = await this.db.store.findUnique({ where: { id }, include: storeInclude }); return store ? mapStore(store) : null; }
  async findPublicStoreBySlug(slug: string): Promise<Store | null> { const store = await this.db.store.findFirst({ where: { slug: slug.toLowerCase(), status: { code: 'ACTIVE' } }, include: storeInclude }); return store ? mapStore(store) : null; }
  async updateStore(id: string, input: { displayName?: string; description?: string | null }): Promise<Store> { return mapStore(await this.db.store.update({ where: { id }, data: input, include: storeInclude })); }
  async findWarehousesByUserId(userId: string): Promise<Warehouse[]> { const warehouses = await this.db.warehouse.findMany({ where: { store: { sellerProfile: { userId } } }, orderBy: [{ storeId: 'asc' }, { code: 'asc' }] }); return warehouses.map(mapWarehouse); }
  async findWarehouseById(id: string): Promise<Warehouse | null> { const warehouse = await this.db.warehouse.findUnique({ where: { id } }); return warehouse ? mapWarehouse(warehouse) : null; }
  async createWarehouse(input: { storeId: string; code: string; name: string }): Promise<Warehouse> {
    try { return mapWarehouse(await this.db.warehouse.create({ data: { ...input, code: input.code.toUpperCase() } })); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'This warehouse code is already in use for the store.'); throw error; }
  }
  async updateWarehouse(id: string, input: { name?: string; isActive?: boolean }): Promise<Warehouse> { return mapWarehouse(await this.db.warehouse.update({ where: { id }, data: input })); }
}
