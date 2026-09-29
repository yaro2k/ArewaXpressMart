import { describe, expect, it } from 'vitest';
import { returnCreateSchema, returnUpdateSchema } from '../src/modules/returns/presentation/returns.schemas.js';
const id = '550e8400-e29b-41d4-a716-446655440000';
describe('returns request validation', () => {
  it('accepts return quantities and supported administrative states', () => { expect(returnCreateSchema.parse({ reasonCode: 'damaged', items: [{ orderItemId: id, quantity: 1 }] }).items[0].quantity).toBe(1); expect(returnUpdateSchema.parse({ status: 'RECEIVED' }).status).toBe('RECEIVED'); });
  it('rejects empty return lines and protected payment states', () => { expect(() => returnCreateSchema.parse({ reasonCode: 'damaged', items: [] })).toThrow(); expect(() => returnUpdateSchema.parse({ status: 'PAID' })).toThrow(); });
});
