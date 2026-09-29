import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { PaymentRepository, PaymentWebhookInput } from '../domain/PaymentRepository.js';

const paymentInclude = { provider: true, status: true, order: { select: { id: true, orderNumber: true, userId: true, status: true } } } satisfies Prisma.PaymentInclude;
function mapPayment(payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>) { return { id: payment.id, orderId: payment.orderId, orderNumber: payment.order.orderNumber, provider: payment.provider.code, providerReference: payment.providerReference, status: payment.status.code, amountMinor: Number(payment.amountMinor), currency: payment.currency, authorizedAt: payment.authorizedAt?.toISOString() ?? null, capturedAt: payment.capturedAt?.toISOString() ?? null, createdAt: payment.createdAt.toISOString() }; }

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly db: PrismaClient) {}
  async createPayment(userId: string, orderId: string, provider: string, idempotencyKey: string): Promise<unknown> {
    const existing = await this.db.payment.findUnique({ where: { orderId_idempotencyKey: { orderId, idempotencyKey } }, include: paymentInclude });
    if (existing) { if (existing.order.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this order.'); return mapPayment(existing); }
    try {
      return await this.db.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { status: true } });
        if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
        if (order.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this order.');
        if (order.status.code !== 'PENDING_PAYMENT') throw new AppError(409, 'INVALID_STATE', 'This order is not awaiting payment.');
        const active = await tx.payment.findFirst({ where: { orderId, status: { code: 'PENDING' } }, include: paymentInclude });
        if (active) return mapPayment(active);
        const [providerRecord, status] = await Promise.all([tx.paymentProvider.findUnique({ where: { code: provider.toUpperCase() } }), tx.paymentStatus.findUnique({ where: { code: 'PENDING' } })]);
        if (!providerRecord || !status) throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Payment provider is not configured.');
        const payment = await tx.payment.create({ data: { orderId, providerId: providerRecord.id, statusId: status.id, providerReference: `AXM-PAY-${randomUUID()}`, idempotencyKey, amountMinor: order.totalMinor, currency: order.currency }, include: paymentInclude });
        return mapPayment(payment);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { const retry = await this.db.payment.findUnique({ where: { orderId_idempotencyKey: { orderId, idempotencyKey } }, include: paymentInclude }); if (retry) return mapPayment(retry); } throw error; }
  }
  async findPaymentForUser(userId: string, paymentId: string): Promise<unknown | null> { const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: paymentInclude }); if (!payment || payment.order.userId !== userId) return null; return mapPayment(payment); }
  async getPaymentInitializationContext(userId: string, paymentId: string) {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, order: { userId } }, select: { providerReference: true, amountMinor: true, currency: true, status: { select: { code: true } }, order: { select: { user: { select: { email: true } } } } } });
    if (!payment) return null;
    return { email: payment.order.user.email, amountMinor: payment.amountMinor, currency: payment.currency, providerReference: payment.providerReference, status: payment.status.code };
  }
  async processWebhook(provider: string, input: PaymentWebhookInput): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const providerRecord = await tx.paymentProvider.findUnique({ where: { code: provider.toUpperCase() } });
      if (!providerRecord) throw new AppError(404, 'NOT_FOUND', 'Payment provider not found.');
      const prior = await tx.paymentWebhookEvent.findUnique({ where: { providerId_providerEventId: { providerId: providerRecord.id, providerEventId: input.eventId } }, include: { payment: { include: paymentInclude } } });
      if (prior?.payment) return mapPayment(prior.payment);
      const payment = await tx.payment.findFirst({ where: { providerId: providerRecord.id, providerReference: input.providerReference }, include: paymentInclude });
      if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment reference not found.');
      if (payment.amountMinor !== BigInt(input.amountMinor) || payment.currency !== input.currency.toUpperCase()) throw new AppError(422, 'PAYMENT_MISMATCH', 'Webhook amount or currency does not match the order payment.');
      const statusCode = input.status === 'SUCCEEDED' ? 'PAID' : input.status;
      const status = await tx.paymentStatus.findUniqueOrThrow({ where: { code: statusCode } });
      if (payment.status.code === 'PAID' && input.status !== 'SUCCEEDED') {
        await tx.paymentWebhookEvent.create({ data: { providerId: providerRecord.id, paymentId: payment.id, providerEventId: input.eventId, eventType: input.eventType, payload: input.payload as Prisma.InputJsonValue, processedAt: new Date() } });
        return mapPayment(payment);
      }
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { statusId: status.id, authorizedAt: input.status === 'SUCCEEDED' ? new Date() : undefined, capturedAt: input.status === 'SUCCEEDED' ? new Date() : undefined }, include: paymentInclude });
      await tx.paymentWebhookEvent.create({ data: { providerId: providerRecord.id, paymentId: payment.id, providerEventId: input.eventId, eventType: input.eventType, payload: input.payload as Prisma.InputJsonValue, processedAt: new Date() } });
      if (input.status === 'SUCCEEDED' && payment.order.status.code === 'PENDING_PAYMENT') { const orderStatus = await tx.orderStatus.findUniqueOrThrow({ where: { code: 'PAID' } }); await tx.order.update({ where: { id: payment.orderId }, data: { statusId: orderStatus.id } }); }
      return mapPayment(updated);
    });
  }
}
