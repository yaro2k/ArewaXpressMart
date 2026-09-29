import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaCartRepository } from '../src/modules/cart/infrastructure/PrismaCartRepository.js';

const databaseUrl = process.env.CART_INTEGRATION_DATABASE_URL;
const db = databaseUrl ? new PrismaClient({ datasources: { db: { url: databaseUrl } } }) : undefined;
const suite = describe.skipIf(!db);

suite('PrismaCartRepository anonymous cart merge', () => {
  afterAll(async () => { await db?.$disconnect(); });

  it('consolidates duplicate lines transactionally and is safe to repeat', async () => {
    const suffix = randomUUID(); const userStatus = await db!.userStatus.create({ data: { code: `TEST_USER_${suffix}` } });
    const sellerStatus = await db!.sellerVerificationStatus.create({ data: { code: `TEST_SELLER_${suffix}` } }); const storeStatus = await db!.storeStatus.upsert({ where: { code: 'ACTIVE' }, create: { code: 'ACTIVE' }, update: {} }); const productStatus = await db!.productStatus.upsert({ where: { code: 'ACTIVE' }, create: { code: 'ACTIVE' }, update: {} });
    const sellerUser = await db!.user.create({ data: { email: `seller-${suffix}@example.test`, firstName: 'Seller', lastName: 'Test', statusId: userStatus.id } }); const customer = await db!.user.create({ data: { email: `customer-${suffix}@example.test`, firstName: 'Customer', lastName: 'Test', statusId: userStatus.id } });
    const seller = await db!.sellerProfile.create({ data: { userId: sellerUser.id, legalName: 'Test Seller', verificationStatusId: sellerStatus.id } }); const store = await db!.store.create({ data: { sellerProfileId: seller.id, slug: `store-${suffix}`, displayName: 'Test Store', statusId: storeStatus.id } });
    const product = await db!.product.create({ data: { storeId: store.id, name: 'Test Product', slug: `product-${suffix}`, description: 'Test', statusId: productStatus.id } }); const variant = await db!.productVariant.create({ data: { productId: product.id, sku: `SKU-${suffix}` } }); await db!.productVariantPrice.create({ data: { productVariantId: variant.id, currency: 'NGN', amountMinor: 1000 } });
    const warehouse = await db!.warehouse.create({ data: { storeId: store.id, code: `W-${suffix}`, name: 'Test warehouse' } }); await db!.inventory.create({ data: { warehouseId: warehouse.id, productVariantId: variant.id, onHandQty: 10 } });
    const repository = new PrismaCartRepository(db!); const tokenHash = 'a'.repeat(63) + 'b'; const expiry = new Date(Date.now() + 60_000);
    try {
      await repository.addItem({ kind: 'anonymous', tokenHash }, { productVariantId: variant.id, quantity: 2, expiresAt: expiry }); await repository.addItem({ kind: 'authenticated', userId: customer.id }, { productVariantId: variant.id, quantity: 3 });
      const merged = await repository.mergeAnonymousCart(customer.id, tokenHash) as { items: Array<{ quantity: number }> }; expect(merged.items).toHaveLength(1); expect(merged.items[0]?.quantity).toBe(5); expect((await repository.getCart({ kind: 'anonymous', tokenHash }) as { id: string }).id).toBe('');
      const repeated = await repository.mergeAnonymousCart(customer.id, tokenHash) as { items: Array<{ quantity: number }> }; expect(repeated.items[0]?.quantity).toBe(5);
      const rejectedTokenHash = 'c'.repeat(64); await repository.addItem({ kind: 'anonymous', tokenHash: rejectedTokenHash }, { productVariantId: variant.id, quantity: 8, expiresAt: expiry }); await expect(repository.mergeAnonymousCart(customer.id, rejectedTokenHash)).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' }); expect((await repository.getCart({ kind: 'authenticated', userId: customer.id }) as { items: Array<{ quantity: number }> }).items[0]?.quantity).toBe(5); expect((await repository.getCart({ kind: 'anonymous', tokenHash: rejectedTokenHash }) as { id: string }).id).not.toBe('');
    } finally {
      await db!.cart.deleteMany({ where: { OR: [{ userId: customer.id }, { anonymousTokenHash: { in: [tokenHash, 'c'.repeat(64)] } }] } }); await db!.inventory.deleteMany({ where: { warehouseId: warehouse.id } }); await db!.warehouse.delete({ where: { id: warehouse.id } }); await db!.product.delete({ where: { id: product.id } }); await db!.store.delete({ where: { id: store.id } }); await db!.sellerProfile.delete({ where: { id: seller.id } }); await db!.user.deleteMany({ where: { id: { in: [sellerUser.id, customer.id] } } }); await db!.sellerVerificationStatus.delete({ where: { id: sellerStatus.id } }); await db!.userStatus.delete({ where: { id: userStatus.id } });
    }
  });
});
