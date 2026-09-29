export interface InvoiceRepository {
  findCustomerInvoice(userId: string, orderId: string): Promise<unknown | null>;
  listInvoices(): Promise<unknown[]>;
  issueInvoice(orderId: string): Promise<unknown>;
}
