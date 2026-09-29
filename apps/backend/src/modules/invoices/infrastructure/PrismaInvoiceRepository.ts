import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { InvoiceRepository } from '../domain/InvoiceRepository.js';
const include = { status: true, items: true, order: { select: { userId: true, orderNumber: true, status: true } } } satisfies Prisma.InvoiceInclude;
function mapInvoice(row: Prisma.InvoiceGetPayload<{ include: typeof include }>) { return { id: row.id, orderId: row.orderId, orderNumber: row.order.orderNumber, invoiceNumber: row.invoiceNumber, status: row.status.code, currency: row.currency, totals: { subtotalMinor: Number(row.subtotalMinor), discountMinor: Number(row.discountMinor), shippingMinor: Number(row.shippingMinor), taxMinor: Number(row.taxMinor), totalMinor: Number(row.totalMinor) }, items: row.items.map((item) => ({ id: item.id, orderItemId: item.orderItemId, description: item.description, sku: item.sku, quantity: item.quantity, unitPriceMinor: Number(item.unitPriceMinor), lineTotalMinor: Number(item.lineTotalMinor), currency: item.currency })), issuedAt: row.issuedAt.toISOString(), dueAt: row.dueAt?.toISOString() ?? null }; }
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: PrismaClient) {}
  async findCustomerInvoice(userId: string, orderId: string): Promise<unknown | null> { const row = await this.db.invoice.findFirst({ where: { orderId, order: { userId } }, include }); return row ? mapInvoice(row) : null; }
  async listInvoices(): Promise<unknown[]> { const rows = await this.db.invoice.findMany({ include, orderBy: { issuedAt: 'desc' } }); return rows.map(mapInvoice); }
  async issueInvoice(orderId: string): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({ where: { orderId }, include });
      if (existing) return mapInvoice(existing);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { status: true, items: true } });
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
      if (!['PAID', 'PROCESSING', 'COMPLETED'].includes(order.status.code)) throw new AppError(409, 'INVALID_STATE', 'Only paid orders can be invoiced.');
      const status = await tx.invoiceStatus.findUniqueOrThrow({ where: { code: 'ISSUED' } });
      const invoice = await tx.invoice.create({ data: { orderId, statusId: status.id, invoiceNumber: `INV-${order.orderNumber}`, currency: order.currency, subtotalMinor: order.subtotalMinor, discountMinor: order.discountMinor, shippingMinor: order.shippingMinor, taxMinor: order.taxMinor, totalMinor: order.totalMinor, items: { create: order.items.map((item) => ({ orderItemId: item.id, description: item.productName, sku: item.sku, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, lineTotalMinor: item.lineTotalMinor, currency: item.currency })) } }, include });
      return mapInvoice(invoice);
    });
  }
}
