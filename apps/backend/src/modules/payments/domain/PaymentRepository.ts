export interface PaymentRepository {
  createPayment(userId: string, orderId: string, provider: string, idempotencyKey: string): Promise<unknown>;
  findPaymentForUser(userId: string, paymentId: string): Promise<unknown | null>;
  processWebhook(provider: string, input: PaymentWebhookInput): Promise<unknown>;
  getPaymentInitializationContext?(userId: string, paymentId: string): Promise<{ email: string; amountMinor: bigint; currency: string; providerReference: string; status: string } | null>;
}

export interface PaymentWebhookInput {
  eventId: string;
  eventType: string;
  providerReference: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  amountMinor: number;
  currency: string;
  payload: Record<string, unknown>;
}
