import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { CheckoutService } from '../src/modules/checkout/application/CheckoutService.js';
import type { CheckoutInput } from '../src/modules/checkout/domain/CheckoutRepository.js';
import { PrismaCheckoutRepository } from '../src/modules/checkout/infrastructure/PrismaCheckoutRepository.js';
import { PrismaPaymentRepository } from '../src/modules/payments/infrastructure/PrismaPaymentRepository.js';
import { PrismaOrdersRepository } from '../src/modules/orders/infrastructure/PrismaOrdersRepository.js';
import { PrismaInvoiceRepository } from '../src/modules/invoices/infrastructure/PrismaInvoiceRepository.js';
import { PrismaReturnsRepository } from '../src/modules/returns/infrastructure/PrismaReturnsRepository.js';
import { PrismaAdminRepository } from '../src/modules/admin/infrastructure/PrismaAdminRepository.js';

const databaseUrl = process.env.COUPON_INTEGRATION_DATABASE_URL;
const db = databaseUrl ? new PrismaClient({ datasources: { db: { url: databaseUrl } } }) : undefined;
const suite = describe.skipIf(!db);

type FixtureRow = { storeId: string; variantId: string; rateId: string };

interface Fixture {
  coupon: { id: string; code: string };
  rows: FixtureRow[];
  recordOrder(orderId: string): void;
  recordCoupon(couponId: string): void;
  customer(name: string, quantity?: number): Promise<{ user: { id: string }; address: { id: string } }>;
  cleanup(): Promise<void>;
}

async function setupFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const created = {
    couponId: undefined as string | undefined,
    extraCouponIds: [] as string[],
    stateId: undefined as string | undefined,
    cityId: undefined as string | undefined,
    carrierId: undefined as string | undefined,
    methodId: undefined as string | undefined,
    verificationId: undefined as string | undefined,
    sellerId: undefined as string | undefined,
    userIds: [] as string[],
    storeIds: [] as string[],
    productIds: [] as string[],
    orderIds: [] as string[],
  };

  const cleanup = async () => {
    if (!db) return;
    // CouponRedemption, not Order.orderNumber, establishes test ownership.
    const redemptionOrderIds = (await db.couponRedemption.findMany({
      where: created.couponId ? { couponId: created.couponId } : { id: { in: [] } },
      select: { orderId: true },
    })).map(({ orderId }) => orderId);
    const orderIds = [...new Set([...created.orderIds, ...redemptionOrderIds])];

    if (orderIds.length) {
      const owned = await db.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          userId: true,
          couponRedemption: { select: { couponId: true } },
          payments: { select: { id: true } },
          shipments: { select: { id: true } },
          returnRequests: { select: { id: true } },
          invoice: { select: { id: true } },
        },
      });
      if (owned.length !== orderIds.length || owned.some((order) =>
        !created.userIds.includes(order.userId) ||
        order.couponRedemption?.couponId !== created.couponId ||
        order.shipments.length)) {
        throw new Error('Fixture cleanup refused to delete an order without exact Phase-A ownership.');
      }
      // Remove restrictive dependents explicitly before stores/orders.
      await db.returnItem.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
      await db.shipmentItem.deleteMany({ where: { shipment: { orderId: { in: orderIds } } } });
      await db.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
      await db.orderShippingSelection.deleteMany({ where: { orderId: { in: orderIds } } });
      const returnIds = owned.flatMap((order) => order.returnRequests.map((request) => request.id));
      if (returnIds.length) {
        await db.refund.deleteMany({ where: { returnRequestId: { in: returnIds } } });
        await db.returnItem.deleteMany({ where: { returnRequestId: { in: returnIds } } });
        await db.returnRequest.deleteMany({ where: { id: { in: returnIds } } });
      }
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      const invoiceIds = owned.flatMap((order) => order.invoice ? [order.invoice.id] : []);
      if (invoiceIds.length) {
        await db.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await db.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }
      await db.orderAddress.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      const paymentIds = owned.flatMap((order) => order.payments.map((payment) => payment.id));
      if (paymentIds.length) {
        await db.paymentWebhookEvent.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
      await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds }, couponId: created.couponId } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (created.userIds.length) {
      await db.cart.deleteMany({ where: { userId: { in: created.userIds } } });
      await db.address.deleteMany({ where: { userId: { in: created.userIds } } });
    }
    if (created.productIds.length) await db.product.deleteMany({ where: { id: { in: created.productIds } } });
    if (created.storeIds.length) await db.shippingRate.deleteMany({ where: { storeId: { in: created.storeIds } } });
    if (created.storeIds.length) await db.store.deleteMany({ where: { id: { in: created.storeIds } } });
    if (created.sellerId) await db.sellerProfile.delete({ where: { id: created.sellerId } });
    if (created.userIds.length) await db.user.deleteMany({ where: { id: { in: created.userIds } } });
    if (created.methodId) await db.shippingMethod.delete({ where: { id: created.methodId } });
    if (created.carrierId) await db.shippingCarrier.delete({ where: { id: created.carrierId } });
    if (created.verificationId) await db.sellerVerificationStatus.delete({ where: { id: created.verificationId } });
    if (created.cityId) await db.city.delete({ where: { id: created.cityId } });
    if (created.stateId) await db.stateProvince.delete({ where: { id: created.stateId } });
    if (created.couponId) await db.coupon.delete({ where: { id: created.couponId } });
    if (created.extraCouponIds.length) await db.coupon.deleteMany({ where: { id: { in: created.extraCouponIds } } });
  };

  try {
    await db!.$transaction([
      db!.userStatus.createMany({ data: [{ code: 'ACTIVE' }], skipDuplicates: true }),
      db!.storeStatus.createMany({ data: [{ code: 'ACTIVE' }], skipDuplicates: true }),
      db!.productStatus.createMany({ data: [{ code: 'ACTIVE' }], skipDuplicates: true }),
      db!.orderStatus.createMany({ data: [{ code: 'PENDING_PAYMENT' }], skipDuplicates: true }),
      db!.orderStatus.createMany({ data: [{ code: 'PAID' }, { code: 'CANCELLED' }], skipDuplicates: true }),
      db!.orderAddressType.createMany({ data: [{ code: 'SHIPPING' }, { code: 'BILLING' }], skipDuplicates: true }),
      db!.paymentProvider.createMany({ data: [{ code: 'PAYSTACK', name: 'Paystack' }], skipDuplicates: true }),
      db!.paymentStatus.createMany({ data: [{ code: 'PENDING' }, { code: 'PAID' }, { code: 'FAILED' }, { code: 'CANCELLED' }], skipDuplicates: true }),
      db!.returnStatus.createMany({ data: [{ code: 'REQUESTED' }, { code: 'APPROVED' }, { code: 'RECEIVED' }, { code: 'CLOSED' }, { code: 'REJECTED' }], skipDuplicates: true }),
      db!.refundStatus.createMany({ data: [{ code: 'REQUESTED' }, { code: 'PROCESSING' }, { code: 'SUCCEEDED' }], skipDuplicates: true }),
      db!.invoiceStatus.createMany({ data: [{ code: 'ISSUED' }], skipDuplicates: true }),
      db!.returnReason.createMany({ data: [{ code: 'DAMAGED', description: 'Damaged' }], skipDuplicates: true }),
      db!.country.createMany({ data: [{ iso2: 'ZZ', name: 'Coupon Integration Reference Country' }], skipDuplicates: true }),
    ]);
    const [userStatus, storeStatus, productStatus, country] = await Promise.all([
      db!.userStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } }),
      db!.storeStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } }),
      db!.productStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } }),
      db!.country.findUniqueOrThrow({ where: { iso2: 'ZZ' } }),
    ]);

    const state = await db!.stateProvince.create({ data: { countryId: country.id, code: suffix.slice(0, 8), name: `State ${suffix}` } });
    created.stateId = state.id;
    const city = await db!.city.create({ data: { stateProvinceId: state.id, name: `City ${suffix}` } });
    created.cityId = city.id;
    const carrier = await db!.shippingCarrier.create({ data: { name: `Carrier ${suffix}` } });
    created.carrierId = carrier.id;
    const method = await db!.shippingMethod.create({ data: { carrierId: carrier.id, code: 'STANDARD', name: 'Standard', serviceLevel: 'Test' } });
    created.methodId = method.id;
    const verification = await db!.sellerVerificationStatus.create({ data: { code: `COUPON_${suffix}` } });
    created.verificationId = verification.id;
    const sellerUser = await db!.user.create({ data: { email: `seller-${suffix}@example.test`, firstName: 'Seller', lastName: 'Test', statusId: userStatus.id } });
    created.userIds.push(sellerUser.id);
    const seller = await db!.sellerProfile.create({ data: { userId: sellerUser.id, legalName: 'Seller', verificationStatusId: verification.id } });
    created.sellerId = seller.id;

    const rows: FixtureRow[] = [];
    for (const [index, price] of [1001n, 999n].entries()) {
      const store = await db!.store.create({ data: { sellerProfileId: seller.id, slug: `coupon-store-${index}-${suffix}`, displayName: `Store ${index}`, statusId: storeStatus.id } });
      created.storeIds.push(store.id);
      const product = await db!.product.create({ data: { storeId: store.id, name: `Product ${index}`, slug: `coupon-product-${index}-${suffix}`, description: 'Test', statusId: productStatus.id } });
      created.productIds.push(product.id);
      const variant = await db!.productVariant.create({ data: { productId: product.id, sku: `SKU-${index}-${suffix}` } });
      await db!.productVariantPrice.create({ data: { productVariantId: variant.id, amountMinor: price, currency: 'NGN' } });
      const rate = await db!.shippingRate.create({ data: { storeId: store.id, shippingMethodId: method.id, cityId: city.id, amountMinor: BigInt(100 + index), currency: 'NGN' } });
      rows.push({ storeId: store.id, variantId: variant.id, rateId: rate.id });
    }
    const coupon = await db!.coupon.create({ data: { code: `SAVE_${suffix.replaceAll('-', '').slice(0, 12).toUpperCase()}`, discountType: 'FIXED_MINOR', fixedDiscountMinor: 501n, currency: 'NGN' } });
    created.couponId = coupon.id;

    return {
      coupon,
      rows,
      recordOrder(orderId: string) { created.orderIds.push(orderId); },
      recordCoupon(couponId: string) { created.extraCouponIds.push(couponId); },
      async customer(name, quantity = 1) {
        const user = await db!.user.create({ data: { email: `${name}-${suffix}@example.test`, firstName: name, lastName: 'Test', statusId: userStatus.id } });
        created.userIds.push(user.id);
        const address = await db!.address.create({ data: { userId: user.id, recipientName: name, phoneE164: '+2348012345678', line1: '1 Test Road', cityId: city.id } });
        await db!.cart.create({ data: { userId: user.id, currency: 'NGN', items: { create: rows.map((row) => ({ productVariantId: row.variantId, quantity, unitPriceMinor: 1n, currency: 'NGN' })) } } });
        return { user, address };
      },
      cleanup,
    };
  } catch (error) {
    try { await cleanup(); } catch { /* Preserve the setup error. */ }
    throw error;
  }
}

function checkoutInput(fixture: Fixture, customer: { address: { id: string } }): CheckoutInput {
  return {
    shippingAddressId: customer.address.id,
    shippingSelections: fixture.rows.map((row) => ({ storeId: row.storeId, shippingRateId: row.rateId })),
    couponCode: fixture.coupon.code,
  };
}

suite('coupon checkout integration', () => {
  afterAll(async () => { await db?.$disconnect(); });

  it('persists multi-store allocation, shipping exclusion, RESERVED redemption, and idempotency', async () => {
    const fixture = await setupFixture();
    try {
      const buyer = await fixture.customer('buyer');
      const input = checkoutInput(fixture, buyer);
      const repository = new PrismaCheckoutRepository(db!);
      const service = new CheckoutService(repository);
      const quote = await repository.quote(buyer.user.id, input) as { subtotalMinor: number; discountMinor: number; shippingMinor: number; totalMinor: number };
      expect(quote).toMatchObject({ subtotalMinor: 2000, discountMinor: 501, shippingMinor: 201, totalMinor: 1700 });

      const key = `idempotency-${randomUUID()}`;
      const order = await service.checkout(buyer.user.id, input, key) as { id: string };
      fixture.recordOrder(order.id);
      expect((await service.checkout(buyer.user.id, input, key) as { id: string }).id).toBe(order.id);

      const saved = await db!.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, shippingSelections: true, couponRedemption: true } });
      expect(saved.couponRedemption?.status).toBe('RESERVED');
      expect(await db!.couponRedemption.count({ where: { couponId: fixture.coupon.id } })).toBe(1);
      expect(await db!.order.count({ where: { userId: buyer.user.id } })).toBe(1);
      expect(saved.items.reduce((sum, item) => sum + item.discountMinor, 0n)).toBe(saved.discountMinor);
      expect(saved.items.every((item) => item.lineTotalMinor === item.unitPriceMinor * BigInt(item.quantity) - item.discountMinor)).toBe(true);
      expect(saved.shippingSelections.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(saved.shippingMinor);
      expect(saved.totalMinor).toBe(saved.subtotalMinor - saved.discountMinor + saved.shippingMinor + saved.taxMinor);
    } finally {
      await fixture.cleanup();
    }
  });

  it('enforces canonical case-insensitive coupon uniqueness while admin creation normalizes codes', async () => {
    const fixture = await setupFixture();
    try {
      const actor = await fixture.customer('coupon-admin');
      const admin = new PrismaAdminRepository(db!);
      const created = await admin.createCoupon(actor.user.id, { code: ` mixed-${randomUUID().slice(0, 8)} `, discountType: 'FIXED_MINOR', fixedDiscountMinor: 10, currency: 'NGN' }) as { id: string; code: string };
      fixture.recordCoupon(created.id);
      expect(created.code).toMatch(/^MIXED-/);
      await expect(db!.coupon.create({ data: { code: created.code.toLowerCase(), discountType: 'FIXED_MINOR', fixedDiscountMinor: 10n, currency: 'NGN' } })).rejects.toMatchObject({ code: 'P2002' });
      const distinct = await db!.coupon.create({ data: { code: `DISTINCT_${randomUUID().slice(0, 8).toUpperCase()}`, discountType: 'FIXED_MINOR', fixedDiscountMinor: 10n, currency: 'NGN' } });
      fixture.recordCoupon(distinct.id);
    } finally { await fixture.cleanup(); }
  });

  it('enforces a global limit across overlapping checkout transactions without loser state', async () => {
    const fixture = await setupFixture();
    const one = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const two = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await db!.coupon.update({ where: { id: fixture.coupon.id }, data: { maximumRedemptions: 1 } });
      const [firstCustomer, secondCustomer] = await Promise.all([fixture.customer('global-a'), fixture.customer('global-b')]);
      const results = await Promise.allSettled([
        new PrismaCheckoutRepository(one).placeOrder(firstCustomer.user.id, { ...checkoutInput(fixture, firstCustomer), idempotencyKey: `global-a-${randomUUID()}` }),
        new PrismaCheckoutRepository(two).placeOrder(secondCustomer.user.id, { ...checkoutInput(fixture, secondCustomer), idempotencyKey: `global-b-${randomUUID()}` }),
      ]);
      results.filter((result): result is PromiseFulfilledResult<{ id: string }> => result.status === 'fulfilled')
        .forEach((result) => fixture.recordOrder(result.value.id));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await db!.couponRedemption.count({ where: { couponId: fixture.coupon.id, status: { in: ['RESERVED', 'REDEEMED'] } } })).toBe(1);
      expect(await db!.order.count({ where: { couponRedemption: { couponId: fixture.coupon.id } } })).toBe(1);
    } finally {
      await one.$disconnect();
      await two.$disconnect();
      await fixture.cleanup();
    }
  });

  it('enforces a per-customer limit across overlapping checkout transactions without loser state', async () => {
    const fixture = await setupFixture();
    const one = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const two = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await db!.coupon.update({ where: { id: fixture.coupon.id }, data: { maximumRedemptionsPerUser: 1 } });
      const customer = await fixture.customer('per-user');
      const input = checkoutInput(fixture, customer);
      const results = await Promise.allSettled([
        new PrismaCheckoutRepository(one).placeOrder(customer.user.id, { ...input, idempotencyKey: `per-user-a-${randomUUID()}` }),
        new PrismaCheckoutRepository(two).placeOrder(customer.user.id, { ...input, idempotencyKey: `per-user-b-${randomUUID()}` }),
      ]);
      results.filter((result): result is PromiseFulfilledResult<{ id: string }> => result.status === 'fulfilled')
        .forEach((result) => fixture.recordOrder(result.value.id));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await db!.couponRedemption.count({ where: { couponId: fixture.coupon.id, userId: customer.user.id, status: { in: ['RESERVED', 'REDEEMED'] } } })).toBe(1);
      expect(await db!.order.count({ where: { userId: customer.user.id, couponRedemption: { couponId: fixture.coupon.id } } })).toBe(1);
    } finally {
      await one.$disconnect();
      await two.$disconnect();
      await fixture.cleanup();
    }
  });

  it('redeems only after a verified successful webhook and is idempotent', async () => {
    const fixture = await setupFixture();
    try {
      const buyer = await fixture.customer('payment');
      const checkout = new CheckoutService(new PrismaCheckoutRepository(db!));
      const order = await checkout.checkout(buyer.user.id, checkoutInput(fixture, buyer), `payment-${randomUUID()}`) as { id: string };
      fixture.recordOrder(order.id);
      const payments = new PrismaPaymentRepository(db!);
      const payment = await payments.createPayment(buyer.user.id, order.id, 'PAYSTACK', `payment-key-${randomUUID()}`) as { id: string; providerReference: string; amountMinor: number; currency: string };
      const input = { eventId: `event-${randomUUID()}`, eventType: 'charge.success', providerReference: payment.providerReference, status: 'SUCCEEDED' as const, amountMinor: payment.amountMinor, currency: payment.currency, payload: { reference: payment.providerReference } };
      await payments.processWebhook('PAYSTACK', input);
      await payments.processWebhook('PAYSTACK', input);
      expect((await db!.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('REDEEMED');
      expect(await db!.couponRedemption.count({ where: { orderId: order.id } })).toBe(1);
      expect(await db!.paymentWebhookEvent.count({ where: { paymentId: payment.id } })).toBe(1);
      expect((await db!.order.findUniqueOrThrow({ where: { id: order.id }, include: { status: true } })).status.code).toBe('PAID');
    } finally { await fixture.cleanup(); }
  });

  it('rejects mismatched payment events without redeeming the coupon', async () => {
    const fixture = await setupFixture();
    try {
      const buyer = await fixture.customer('rejected-payment');
      const order = await new CheckoutService(new PrismaCheckoutRepository(db!)).checkout(buyer.user.id, checkoutInput(fixture, buyer), `rejected-${randomUUID()}`) as { id: string };
      fixture.recordOrder(order.id);
      const payments = new PrismaPaymentRepository(db!);
      const payment = await payments.createPayment(buyer.user.id, order.id, 'PAYSTACK', `rejected-key-${randomUUID()}`) as { providerReference: string; amountMinor: number; currency: string };
      await expect(payments.processWebhook('PAYSTACK', { eventId: `bad-${randomUUID()}`, eventType: 'charge.success', providerReference: payment.providerReference, status: 'SUCCEEDED', amountMinor: payment.amountMinor + 1, currency: payment.currency, payload: {} })).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
      expect((await db!.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('RESERVED');
    } finally { await fixture.cleanup(); }
  });

  it('releases unpaid reservations on cancellation and permits capacity reuse, but rejects paid cancellation', async () => {
    const fixture = await setupFixture();
    try {
      await db!.coupon.update({ where: { id: fixture.coupon.id }, data: { maximumRedemptions: 1 } });
      const buyer = await fixture.customer('cancel');
      const order = await new CheckoutService(new PrismaCheckoutRepository(db!)).checkout(buyer.user.id, checkoutInput(fixture, buyer), `cancel-${randomUUID()}`) as { id: string };
      fixture.recordOrder(order.id);
      const orders = new PrismaOrdersRepository(db!);
      await orders.cancelOrder(buyer.user.id, order.id, 'test');
      expect((await db!.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('RELEASED');
      const replacement = await fixture.customer('replacement');
      const replacementOrder = await new CheckoutService(new PrismaCheckoutRepository(db!)).checkout(replacement.user.id, checkoutInput(fixture, replacement), `replacement-${randomUUID()}`) as { id: string };
      fixture.recordOrder(replacementOrder.id);
      const paymentRepo = new PrismaPaymentRepository(db!);
      const payment = await paymentRepo.createPayment(replacement.user.id, replacementOrder.id, 'PAYSTACK', `paid-${randomUUID()}`) as { providerReference: string; amountMinor: number; currency: string };
      await paymentRepo.processWebhook('PAYSTACK', { eventId: `paid-event-${randomUUID()}`, eventType: 'charge.success', providerReference: payment.providerReference, status: 'SUCCEEDED', amountMinor: payment.amountMinor, currency: payment.currency, payload: {} });
      await expect(orders.cancelOrder(replacement.user.id, replacementOrder.id, 'late')).rejects.toMatchObject({ code: 'INVALID_STATE' });
      expect((await db!.couponRedemption.findUniqueOrThrow({ where: { orderId: replacementOrder.id } })).status).toBe('REDEEMED');
    } finally { await fixture.cleanup(); }
  });

  it('snapshots discounted order values and item discounts in an immutable invoice', async () => {
    const fixture = await setupFixture();
    try {
      const buyer = await fixture.customer('invoice');
      const order = await new CheckoutService(new PrismaCheckoutRepository(db!)).checkout(buyer.user.id, checkoutInput(fixture, buyer), `invoice-${randomUUID()}`) as { id: string };
      fixture.recordOrder(order.id);
      const paymentRepo = new PrismaPaymentRepository(db!);
      const payment = await paymentRepo.createPayment(buyer.user.id, order.id, 'PAYSTACK', `invoice-payment-${randomUUID()}`) as { providerReference: string; amountMinor: number; currency: string };
      await paymentRepo.processWebhook('PAYSTACK', { eventId: `invoice-event-${randomUUID()}`, eventType: 'charge.success', providerReference: payment.providerReference, status: 'SUCCEEDED', amountMinor: payment.amountMinor, currency: payment.currency, payload: {} });
      const invoiceRepo = new PrismaInvoiceRepository(db!);
      const invoice = await invoiceRepo.issueInvoice(order.id) as { totals: Record<string, number>; items: Array<Record<string, number | string>> };
      const savedOrder = await db!.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      expect(invoice.totals).toEqual({ subtotalMinor: Number(savedOrder.subtotalMinor), discountMinor: Number(savedOrder.discountMinor), shippingMinor: Number(savedOrder.shippingMinor), taxMinor: Number(savedOrder.taxMinor), totalMinor: Number(savedOrder.totalMinor) });
      expect(invoice.items.map((item) => [item.orderItemId, item.discountMinor, item.lineTotalMinor])).toEqual(savedOrder.items.map((item) => [item.id, Number(item.discountMinor), Number(item.lineTotalMinor)]));
      await db!.coupon.update({ where: { id: fixture.coupon.id }, data: { fixedDiscountMinor: 1n } });
      const repeated = await invoiceRepo.issueInvoice(order.id) as { id: string; totals: Record<string, number> };
      expect(repeated.id).toBe((invoice as { id: string }).id);
      expect(repeated.totals).toEqual(invoice.totals);
    } finally { await fixture.cleanup(); }
  });

  it('refunds discounted merchandise using cumulative integer net-line allocation and preserves REDEEMED', async () => {
    const fixture = await setupFixture();
    try {
      const buyer = await fixture.customer('refund', 3);
      const order = await new CheckoutService(new PrismaCheckoutRepository(db!)).checkout(buyer.user.id, checkoutInput(fixture, buyer), `refund-${randomUUID()}`) as { id: string };
      fixture.recordOrder(order.id);
      const paymentRepo = new PrismaPaymentRepository(db!);
      const payment = await paymentRepo.createPayment(buyer.user.id, order.id, 'PAYSTACK', `refund-payment-${randomUUID()}`) as { providerReference: string; amountMinor: number; currency: string };
      await paymentRepo.processWebhook('PAYSTACK', { eventId: `refund-event-${randomUUID()}`, eventType: 'charge.success', providerReference: payment.providerReference, status: 'SUCCEEDED', amountMinor: payment.amountMinor, currency: payment.currency, payload: {} });
      const item = (await db!.orderItem.findFirstOrThrow({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } }));
      const status = await db!.returnStatus.findUniqueOrThrow({ where: { code: 'RECEIVED' } });
      const reason = await db!.returnReason.findUniqueOrThrow({ where: { code: 'DAMAGED' } });
      const returns = new PrismaReturnsRepository(db!);
      const net = item.lineTotalMinor;
      let prior = 0;
      for (const [index, quantity] of [1, 1, 1].entries()) {
        const request = await db!.returnRequest.create({ data: { orderId: order.id, userId: buyer.user.id, statusId: status.id, reasonId: reason.id, items: { create: [{ orderItemId: item.id, quantity }] } } });
        const expected = Number((net * BigInt(prior + quantity)) / 3n - (net * BigInt(prior)) / 3n);
        const refundKey = `refund-${index}-${randomUUID()}`;
        const refund = await returns.createRefund(request.id, refundKey) as { amountMinor: number };
        expect(refund.amountMinor).toBe(expected);
        if (index === 0) expect((await returns.createRefund(request.id, refundKey) as { amountMinor: number }).amountMinor).toBe(expected);
        prior += quantity;
      }
      const totalRefunded = await db!.refund.aggregate({ where: { paymentId: payment.id }, _sum: { amountMinor: true } });
      expect(totalRefunded._sum.amountMinor).toBe(net);
      expect((await db!.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('REDEEMED');
    } finally { await fixture.cleanup(); }
  });
});
