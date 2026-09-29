import { AppError } from '../../../shared/domain/AppError.js';
import type { InvoiceRepository } from '../domain/InvoiceRepository.js';
export class InvoiceService {
  constructor(private readonly repository: InvoiceRepository) {}
  async getCustomerInvoice(userId: string, orderId: string) { const invoice = await this.repository.findCustomerInvoice(userId, orderId); if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found.'); return invoice; }
  list() { return this.repository.listInvoices(); }
  issue(orderId: string) { return this.repository.issueInvoice(orderId); }
}
