import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';
describe('formatMoney', () => { it('formats normal NGN minor units', () => expect(formatMoney(150000, 'NGN')).toContain('1,500.00')); it('formats zero', () => expect(formatMoney(0, 'NGN')).toContain('0.00')); it('formats large amounts without losing integer precision', () => expect(formatMoney(99999999900, 'NGN')).toContain('999,999,999.00')); it('honours the server currency', () => expect(formatMoney(12345, 'USD')).toContain('$123.45')); });
