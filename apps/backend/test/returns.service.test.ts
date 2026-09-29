import { describe, expect, it, vi } from 'vitest';
import { ReturnsService } from '../src/modules/returns/application/ReturnsService.js';
import type { ReturnRepository } from '../src/modules/returns/domain/ReturnsRepository.js';
const userId = '550e8400-e29b-41d4-a716-446655440000'; const returnId = '660e8400-e29b-41d4-a716-446655440000';
function repository(overrides: Partial<ReturnRepository> = {}): ReturnRepository { return { createReturn: async () => ({ id: returnId }), listReturns: async () => [], findReturn: async () => ({ id: returnId }), adminListReturns: async () => [], adminUpdateReturn: async () => ({ id: returnId, status: 'RECEIVED' }), createRefund: async () => ({ id: 'refund-1', amountMinor: 1000 }), ...overrides }; }
describe('ReturnsService', () => {
  it('creates a return through the customer-owned order boundary', async () => { const create = vi.fn(async () => ({ id: returnId })); const service = new ReturnsService(repository({ createReturn: create })); await expect(service.create(userId, 'order-1', 'DAMAGED', [{ orderItemId: 'item-1', quantity: 1 }])).resolves.toEqual({ id: returnId }); expect(create).toHaveBeenCalledWith(userId, 'order-1', 'DAMAGED', [{ orderItemId: 'item-1', quantity: 1 }], undefined); });
  it('does not expose another customer’s return', async () => { const service = new ReturnsService(repository({ findReturn: async () => null })); await expect(service.get(userId, returnId)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' }); });
  it('delegates refund creation with the caller-supplied idempotency key', async () => { const refund = vi.fn(async () => ({ id: 'refund-1' })); const service = new ReturnsService(repository({ createRefund: refund })); await expect(service.refund(returnId, 'refund-key-2026-001')).resolves.toEqual({ id: 'refund-1' }); expect(refund).toHaveBeenCalledWith(returnId, 'refund-key-2026-001'); });
});
