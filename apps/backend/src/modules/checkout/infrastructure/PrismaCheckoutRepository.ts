import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { AddressInput, CheckoutInput, CheckoutRepository } from '../domain/CheckoutRepository.js';

const addressInclude = { city: { include: { stateProvince: { include: { country: true } } } } } satisfies Prisma.AddressInclude;
const orderInclude = { status: true, addresses: { include: { type: true } }, items: { include: { store: true } } } satisfies Prisma.OrderInclude;

function mapAddress(address: Prisma.AddressGetPayload<{ include: typeof addressInclude }>) {
  return { id: address.id, recipientName: address.recipientName, phoneE164: address.phoneE164, line1: address.line1, line2: address.line2, postalCode: address.postalCode, isDefaultShipping: address.isDefaultShipping, isDefaultBilling: address.isDefaultBilling, city: { id: address.city.id, name: address.city.name, state: { id: address.city.stateProvince.id, name: address.city.stateProvince.name, country: { code: address.city.stateProvince.country.iso2, name: address.city.stateProvince.country.name } } } };
}
function mapOrder(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
  return { id: order.id, orderNumber: order.orderNumber, status: order.status.code, currency: order.currency, totals: { subtotalMinor: Number(order.subtotalMinor), discountMinor: Number(order.discountMinor), shippingMinor: Number(order.shippingMinor), taxMinor: Number(order.taxMinor), totalMinor: Number(order.totalMinor) }, addresses: order.addresses.map((address) => ({ type: address.type.code, recipientName: address.recipientName, phoneE164: address.phoneE164, line1: address.line1, line2: address.line2, cityName: address.cityName, stateName: address.stateName, countryCode: address.countryCode, postalCode: address.postalCode })), items: order.items.map((item) => ({ id: item.id, store: { id: item.store.id, slug: item.store.slug, displayName: item.store.displayName }, productName: item.productName, sku: item.sku, quantity: item.quantity, unitPriceMinor: Number(item.unitPriceMinor), lineTotalMinor: Number(item.lineTotalMinor), currency: item.currency })), placedAt: order.placedAt.toISOString() };
}

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCountries(): Promise<unknown[]> { return this.db.country.findMany({ orderBy: { name: 'asc' }, select: { id: true, iso2: true, name: true } }); }
  async listStates(countryId?: string): Promise<unknown[]> { return this.db.stateProvince.findMany({ where: countryId ? { countryId } : undefined, orderBy: { name: 'asc' }, select: { id: true, countryId: true, code: true, name: true } }); }
  async listCities(stateProvinceId?: string): Promise<unknown[]> { return this.db.city.findMany({ where: stateProvinceId ? { stateProvinceId } : undefined, orderBy: { name: 'asc' }, select: { id: true, stateProvinceId: true, name: true } }); }

  async listAddresses(userId: string): Promise<unknown[]> { const addresses = await this.db.address.findMany({ where: { userId }, include: addressInclude, orderBy: { createdAt: 'asc' } }); return addresses.map(mapAddress); }
  async createAddress(userId: string, input: AddressInput): Promise<unknown> { return mapAddress(await this.writeAddress(userId, input)); }
  async findAddressOwner(addressId: string): Promise<{ userId: string } | null> { const address = await this.db.address.findUnique({ where: { id: addressId }, select: { userId: true } }); return address; }
  async updateAddress(addressId: string, input: Partial<AddressInput>): Promise<unknown> {
    const userId = (await this.db.address.findUniqueOrThrow({ where: { id: addressId }, select: { userId: true } })).userId;
    return mapAddress(await this.writeAddress(userId, input, addressId));
  }
  async deleteAddress(addressId: string): Promise<void> { await this.db.address.delete({ where: { id: addressId } }); }

  async quote(userId: string, input: CheckoutInput): Promise<unknown> {
    const quote = await this.db.$transaction((tx) => this.buildQuote(tx, userId, input));
    return {
      currency: quote.currency,
      lines: quote.lines.map((line) => ({ productVariantId: line.productVariantId, storeId: line.storeId, productName: line.productName, sku: line.sku, quantity: line.quantity, unitPriceMinor: Number(line.unitPriceMinor), lineTotalMinor: Number(line.lineTotalMinor), currency: line.currency })),
      subtotalMinor: Number(quote.subtotalMinor), discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: Number(quote.totalMinor),
      shippingAddress: mapAddress(quote.shippingAddress), billingAddress: mapAddress(quote.billingAddress),
    };
  }
  async findOrderByIdempotencyKey(userId: string, idempotencyKey: string): Promise<unknown | null> { const order = await this.db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: orderInclude }); return order ? mapOrder(order) : null; }
  async placeOrder(userId: string, input: CheckoutInput & { idempotencyKey: string }): Promise<unknown> {
    try {
      return await this.db.$transaction(async (tx) => {
        const quote = await this.buildQuote(tx, userId, input);
        const pendingPayment = await tx.orderStatus.findUniqueOrThrow({ where: { code: 'PENDING_PAYMENT' }, select: { id: true } });
        const shippingType = await tx.orderAddressType.findUniqueOrThrow({ where: { code: 'SHIPPING' }, select: { id: true } });
        const billingType = await tx.orderAddressType.findUniqueOrThrow({ where: { code: 'BILLING' }, select: { id: true } });
        const order = await tx.order.create({ data: {
          orderNumber: `AXM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`, userId, statusId: pendingPayment.id, idempotencyKey: input.idempotencyKey, currency: quote.currency, subtotalMinor: quote.subtotalMinor, totalMinor: quote.totalMinor,
          addresses: { create: [this.snapshotAddress(shippingType.id, quote.shippingAddress), this.snapshotAddress(billingType.id, quote.billingAddress)] },
          items: { create: quote.lines.map((line) => ({ storeId: line.storeId, productVariantId: line.productVariantId, productName: line.productName, sku: line.sku, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, lineTotalMinor: line.lineTotalMinor, currency: line.currency })) },
        }, include: orderInclude });
        await tx.cartItem.deleteMany({ where: { cartId: quote.cartId } });
        return mapOrder(order);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { const existing = await this.findOrderByIdempotencyKey(userId, input.idempotencyKey); if (existing) return existing; }
      throw error;
    }
  }

  private async writeAddress(userId: string, input: Partial<AddressInput>, addressId?: string) {
    return this.db.$transaction(async (tx) => {
      if (input.cityId && !await tx.city.findUnique({ where: { id: input.cityId }, select: { id: true } })) throw new AppError(404, 'NOT_FOUND', 'City not found.');
      if (input.isDefaultShipping) await tx.address.updateMany({ where: { userId, ...(addressId ? { id: { not: addressId } } : {}) }, data: { isDefaultShipping: false } });
      if (input.isDefaultBilling) await tx.address.updateMany({ where: { userId, ...(addressId ? { id: { not: addressId } } : {}) }, data: { isDefaultBilling: false } });
      return addressId ? tx.address.update({ where: { id: addressId }, data: input, include: addressInclude }) : tx.address.create({ data: { userId, recipientName: input.recipientName!, phoneE164: input.phoneE164!, line1: input.line1!, line2: input.line2, cityId: input.cityId!, postalCode: input.postalCode, isDefaultShipping: input.isDefaultShipping, isDefaultBilling: input.isDefaultBilling }, include: addressInclude });
    });
  }

  private async buildQuote(tx: Prisma.TransactionClient, userId: string, input: CheckoutInput) {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: { include: { store: { include: { status: true } }, status: true } },
                prices: { where: { endsAt: null }, orderBy: { startsAt: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) throw new AppError(422, 'EMPTY_CART', 'Your cart is empty.');
    const shippingAddress = await tx.address.findFirst({ where: { id: input.shippingAddressId, userId }, include: addressInclude });
    if (!shippingAddress) throw new AppError(404, 'NOT_FOUND', 'Shipping address not found.');
    const billingAddress = input.billingAddressId ? await tx.address.findFirst({ where: { id: input.billingAddressId, userId }, include: addressInclude }) : shippingAddress;
    if (!billingAddress) throw new AppError(404, 'NOT_FOUND', 'Billing address not found.');
    const lines = cart.items.map((item) => {
      const variant = item.productVariant; const price = variant.prices[0];
      if (!variant.isActive || variant.product.status.code !== 'ACTIVE' || variant.product.store.status.code !== 'ACTIVE') throw new AppError(422, 'PRODUCT_UNAVAILABLE', 'One or more cart items are no longer available.');
      if (!price) throw new AppError(422, 'PRICE_UNAVAILABLE', 'One or more cart items have no active price.');
      if (price.currency !== cart.currency) throw new AppError(422, 'CURRENCY_MISMATCH', 'All cart items must use the cart currency.');
      const lineTotalMinor = price.amountMinor * BigInt(item.quantity);
      return { productVariantId: variant.id, storeId: variant.product.store.id, productName: variant.product.name, sku: variant.sku, quantity: item.quantity, unitPriceMinor: price.amountMinor, lineTotalMinor, currency: price.currency };
    });
    const subtotalMinor = lines.reduce((total, line) => total + line.lineTotalMinor, 0n);
    return { cartId: cart.id, currency: cart.currency, lines, subtotalMinor, totalMinor: subtotalMinor, shippingAddress, billingAddress };
  }

  private snapshotAddress(typeId: string, address: Prisma.AddressGetPayload<{ include: typeof addressInclude }>) {
    return { typeId, recipientName: address.recipientName, phoneE164: address.phoneE164, line1: address.line1, line2: address.line2, cityName: address.city.name, stateName: address.city.stateProvince.name, countryCode: address.city.stateProvince.country.iso2, postalCode: address.postalCode };
  }
}
