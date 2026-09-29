import { AppError } from '../../../shared/domain/AppError.js';
import type { ReturnItemInput, ReturnRepository } from '../domain/ReturnsRepository.js';
export class ReturnsService {
  constructor(private readonly repository: ReturnRepository) {}
  create(userId: string, orderId: string, reasonCode: string, items: ReturnItemInput[], note?: string) { return this.repository.createReturn(userId, orderId, reasonCode, items, note); }
  list(userId: string) { return this.repository.listReturns(userId); }
  async get(userId: string, returnId: string) { const value = await this.repository.findReturn(userId, returnId); if (!value) throw new AppError(404, 'NOT_FOUND', 'Return request not found.'); return value; }
  adminList() { return this.repository.adminListReturns(); }
  adminUpdate(returnId: string, status: 'APPROVED' | 'RECEIVED' | 'REJECTED' | 'CLOSED', resolutionCode?: string, note?: string) { return this.repository.adminUpdateReturn(returnId, status, resolutionCode, note); }
  refund(returnId: string, idempotencyKey: string) { return this.repository.createRefund(returnId, idempotencyKey); }
}
