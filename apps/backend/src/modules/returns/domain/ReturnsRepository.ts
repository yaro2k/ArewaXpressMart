export interface ReturnItemInput { orderItemId: string; quantity: number; }
export interface ReturnRepository {
  createReturn(userId: string, orderId: string, reasonCode: string, items: ReturnItemInput[], note?: string): Promise<unknown>;
  listReturns(userId: string): Promise<unknown[]>;
  findReturn(userId: string, returnId: string): Promise<unknown | null>;
  adminListReturns(): Promise<unknown[]>;
  adminUpdateReturn(returnId: string, status: 'APPROVED' | 'RECEIVED' | 'REJECTED' | 'CLOSED', resolutionCode?: string, note?: string): Promise<unknown>;
  createRefund(returnId: string, idempotencyKey: string): Promise<unknown>;
}
