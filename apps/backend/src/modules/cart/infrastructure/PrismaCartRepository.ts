import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { CartOwner, CartRepository } from '../domain/CartRepository.js';

const cartInclude = { items: { include: { productVariant: { include: { product: { include: { store: true } }, prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' as const }, take: 1 } } } }, orderBy: { createdAt: 'asc' as const } } } satisfies Prisma.CartInclude;
type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type Db = PrismaClient | Prisma.TransactionClient;
const emptyCart = { id: '', currency: 'NGN', items: [] };

function mapCart(cart: CartWithItems) { return { id: cart.id, currency: cart.currency, items: cart.items.map((item) => ({ id: item.id, quantity: item.quantity, unitPrice: { amountMinor: Number(item.unitPriceMinor), currency: item.currency }, productVariant: { id: item.productVariant.id, sku: item.productVariant.sku, isActive: item.productVariant.isActive, product: { id: item.productVariant.product.id, name: item.productVariant.product.name, slug: item.productVariant.product.slug, store: { id: item.productVariant.product.store.id, slug: item.productVariant.product.store.slug, displayName: item.productVariant.product.store.displayName } }, currentPrice: item.productVariant.prices[0] ? { amountMinor: Number(item.productVariant.prices[0].amountMinor), currency: item.productVariant.prices[0].currency } : null } })) }; }

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly db: PrismaClient) {}

  async getCart(owner: CartOwner): Promise<unknown> {
    if (owner.kind === 'authenticated') return mapCart(await this.db.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {}, include: cartInclude }));
    const cart = await this.db.cart.findFirst({ where: { anonymousTokenHash: owner.tokenHash, expiresAt: { gt: new Date() } }, include: cartInclude });
    return cart ? mapCart(cart) : emptyCart;
  }

  async addItem(owner: CartOwner, input: { productVariantId: string; quantity: number; expiresAt?: Date }): Promise<unknown> {
    return this.serializable(async (tx) => {
      const variant = await this.findSaleableVariant(tx, input.productVariantId); const price = variant.prices[0]!;
      const cart = await this.getOrCreateCart(tx, owner, price.currency, input.expiresAt);
      if (cart.currency !== price.currency) throw new AppError(422, 'CURRENCY_MISMATCH', 'All cart items must use the cart currency.');
      const existing = await tx.cartItem.findUnique({ where: { cartId_productVariantId: { cartId: cart.id, productVariantId: variant.id } }, select: { quantity: true } });
      const quantity = (existing?.quantity ?? 0) + input.quantity;
      if (quantity > 999) throw new AppError(422, 'CART_QUANTITY_LIMIT', 'Cart item quantity cannot exceed 999.');
      await this.assertAvailableQuantity(tx, variant.id, quantity);
      await tx.cartItem.upsert({ where: { cartId_productVariantId: { cartId: cart.id, productVariantId: variant.id } }, create: { cartId: cart.id, productVariantId: variant.id, quantity, unitPriceMinor: price.amountMinor, currency: price.currency }, update: { quantity, unitPriceMinor: price.amountMinor, currency: price.currency } });
      return mapCart(await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
    });
  }

  async updateItem(owner: CartOwner, cartItemId: string, quantity: number): Promise<unknown> {
    return this.serializable(async (tx) => {
      const item = await tx.cartItem.findUnique({ where: { id: cartItemId }, select: { id: true, cartId: true, productVariantId: true, cart: { select: { userId: true, anonymousTokenHash: true, expiresAt: true } } } });
      this.assertItemOwner(item, owner); await this.findSaleableVariant(tx, item.productVariantId); await this.assertAvailableQuantity(tx, item.productVariantId, quantity);
      await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
      return mapCart(await tx.cart.findUniqueOrThrow({ where: { id: item.cartId }, include: cartInclude }));
    });
  }

  async deleteItem(owner: CartOwner, cartItemId: string): Promise<void> {
    await this.serializable(async (tx) => { const item = await tx.cartItem.findUnique({ where: { id: cartItemId }, select: { id: true, cart: { select: { userId: true, anonymousTokenHash: true, expiresAt: true } } } }); this.assertItemOwner(item, owner); await tx.cartItem.delete({ where: { id: item.id } }); });
  }

  async mergeAnonymousCart(userId: string, anonymousTokenHash?: string): Promise<unknown> {
    if (!anonymousTokenHash) return this.getCart({ kind: 'authenticated', userId });
    return this.serializable(async (tx) => {
      const anonymous = await tx.cart.findFirst({ where: { anonymousTokenHash, expiresAt: { gt: new Date() } }, include: cartInclude });
      const authenticated = await this.getOrCreateCart(tx, { kind: 'authenticated', userId });
      if (!anonymous) return mapCart(await tx.cart.findUniqueOrThrow({ where: { id: authenticated.id }, include: cartInclude }));
      for (const anonymousItem of anonymous.items) {
        const variant = await this.findSaleableVariant(tx, anonymousItem.productVariantId); const price = variant.prices[0]!;
        if (authenticated.currency !== price.currency) throw new AppError(422, 'CURRENCY_MISMATCH', 'All cart items must use the cart currency.');
        const existing = await tx.cartItem.findUnique({ where: { cartId_productVariantId: { cartId: authenticated.id, productVariantId: variant.id } }, select: { quantity: true } });
        const quantity = (existing?.quantity ?? 0) + anonymousItem.quantity;
        if (quantity > 999) throw new AppError(422, 'CART_QUANTITY_LIMIT', 'Cart item quantity cannot exceed 999.');
        await this.assertAvailableQuantity(tx, variant.id, quantity);
        await tx.cartItem.upsert({ where: { cartId_productVariantId: { cartId: authenticated.id, productVariantId: variant.id } }, create: { cartId: authenticated.id, productVariantId: variant.id, quantity, unitPriceMinor: price.amountMinor, currency: price.currency }, update: { quantity, unitPriceMinor: price.amountMinor, currency: price.currency } });
      }
      await tx.cart.delete({ where: { id: anonymous.id } });
      return mapCart(await tx.cart.findUniqueOrThrow({ where: { id: authenticated.id }, include: cartInclude }));
    });
  }

  private async getOrCreateCart(tx: Db, owner: CartOwner, currency = 'NGN', expiresAt?: Date) {
    if (owner.kind === 'authenticated') return tx.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId, currency }, update: {}, select: { id: true, currency: true } });
    const existing = await tx.cart.findUnique({ where: { anonymousTokenHash: owner.tokenHash }, select: { expiresAt: true } });
    if (existing?.expiresAt && existing.expiresAt <= new Date()) throw new AppError(409, 'ANONYMOUS_CART_EXPIRED', 'Anonymous cart has expired.');
    return tx.cart.upsert({ where: { anonymousTokenHash: owner.tokenHash }, create: { anonymousTokenHash: owner.tokenHash, currency, expiresAt: expiresAt! }, update: { expiresAt: expiresAt! }, select: { id: true, currency: true } });
  }
  private async findSaleableVariant(tx: Db, productVariantId: string) {
    const variant = await tx.productVariant.findFirst({ where: { id: productVariantId, isActive: true, product: { status: { code: 'ACTIVE' }, store: { status: { code: 'ACTIVE' } } } }, include: { prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' }, take: 1 } } });
    if (!variant) throw new AppError(404, 'NOT_FOUND', 'Product variant is not available.'); if (!variant.prices[0]) throw new AppError(422, 'PRICE_UNAVAILABLE', 'Product variant has no active price.'); return variant;
  }
  private async assertAvailableQuantity(tx: Db, productVariantId: string, requestedQuantity: number): Promise<void> {
    const rows = await tx.inventory.findMany({ where: { productVariantId, warehouse: { isActive: true, store: { status: { code: 'ACTIVE' } } } }, select: { onHandQty: true, reservedQty: true } });
    const available = rows.reduce((total, row) => total + row.onHandQty - row.reservedQty, 0); if (requestedQuantity > available) throw new AppError(422, 'INSUFFICIENT_INVENTORY', 'Not enough stock is currently available.');
  }
  private assertItemOwner(item: { id: string; cart: { userId: string | null; anonymousTokenHash: string | null; expiresAt: Date | null } } | null, owner: CartOwner): asserts item is { id: string; cart: { userId: string | null; anonymousTokenHash: string | null; expiresAt: Date | null } } {
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.'); const owned = owner.kind === 'authenticated' ? item.cart.userId === owner.userId : item.cart.anonymousTokenHash === owner.tokenHash && item.cart.expiresAt !== null && item.cart.expiresAt > new Date(); if (!owned) throw new AppError(403, 'FORBIDDEN', 'You do not own this cart item.');
  }
  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) { try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error; } }
    throw new AppError(409, 'CONFLICT', 'Cart changed; retry the request.');
  }
}
