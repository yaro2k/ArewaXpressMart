import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { CartRepository } from '../domain/CartRepository.js';

const cartInclude = {
  items: {
    include: {
      productVariant: {
        include: {
          product: { include: { store: true } },
          prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' as const }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

function mapCart(cart: Prisma.CartGetPayload<{ include: typeof cartInclude }>) {
  return {
    id: cart.id,
    currency: cart.currency,
    items: cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: { amountMinor: Number(item.unitPriceMinor), currency: item.currency },
      productVariant: {
        id: item.productVariant.id,
        sku: item.productVariant.sku,
        isActive: item.productVariant.isActive,
        product: { id: item.productVariant.product.id, name: item.productVariant.product.name, slug: item.productVariant.product.slug, store: { id: item.productVariant.product.store.id, slug: item.productVariant.product.store.slug, displayName: item.productVariant.product.store.displayName } },
        currentPrice: item.productVariant.prices[0] ? { amountMinor: Number(item.productVariant.prices[0].amountMinor), currency: item.productVariant.prices[0].currency } : null,
      },
    })),
  };
}

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly db: PrismaClient) {}

  async getOrCreateCart(userId: string): Promise<unknown> {
    const cart = await this.db.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: cartInclude });
    return mapCart(cart);
  }

  async addItem(userId: string, input: { productVariantId: string; quantity: number }): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.productVariantId, isActive: true, product: { status: { code: 'ACTIVE' }, store: { status: { code: 'ACTIVE' } } } },
        include: { prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' }, take: 1 } },
      });
      if (!variant) throw new AppError(404, 'NOT_FOUND', 'Product variant is not available.');
      const price = variant.prices[0];
      if (!price) throw new AppError(422, 'PRICE_UNAVAILABLE', 'Product variant has no active price.');
      const cart = await tx.cart.upsert({ where: { userId }, create: { userId, currency: price.currency }, update: {}, select: { id: true } });
      await tx.cartItem.upsert({
        where: { cartId_productVariantId: { cartId: cart.id, productVariantId: input.productVariantId } },
        create: { cartId: cart.id, productVariantId: input.productVariantId, quantity: input.quantity, unitPriceMinor: price.amountMinor, currency: price.currency },
        update: { quantity: { increment: input.quantity }, unitPriceMinor: price.amountMinor, currency: price.currency },
      });
      const result = await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
      return mapCart(result);
    });
  }

  async findCartItemOwner(cartItemId: string): Promise<{ userId: string } | null> {
    const item = await this.db.cartItem.findUnique({ where: { id: cartItemId }, select: { cart: { select: { userId: true } } } });
    return item ? { userId: item.cart.userId } : null;
  }

  async updateItem(cartItemId: string, quantity: number): Promise<unknown> {
    const item = await this.db.cartItem.update({ where: { id: cartItemId }, data: { quantity }, select: { cartId: true } });
    const cart = await this.db.cart.findUniqueOrThrow({ where: { id: item.cartId }, include: cartInclude });
    return mapCart(cart);
  }

  async deleteItem(cartItemId: string): Promise<void> { await this.db.cartItem.delete({ where: { id: cartItemId } }); }
}
