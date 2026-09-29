import { describe, expect, it } from 'vitest';
import { loginSchema, passwordResetConfirmSchema, profileUpdateSchema, registerSchema } from '../src/modules/identity/presentation/auth.schemas.js';

describe('authentication request validation', () => {
  it('accepts a valid registration request', () => {
    expect(registerSchema.parse({ email: 'customer@example.com', password: 'SafePassword123', firstName: 'Amina', lastName: 'Yusuf', phoneE164: '+2348012345678' }).email).toBe('customer@example.com');
  });

  it('rejects a weak password and unknown fields', () => {
    expect(() => registerSchema.parse({ email: 'customer@example.com', password: 'weak', firstName: 'Amina', lastName: 'Yusuf', admin: true })).toThrow();
  });

  it('requires credentials for login', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: '' })).toThrow();
  });

  it('accepts a strong password reset and rejects weak replacements', () => {
    const token = 'a'.repeat(64);
    expect(passwordResetConfirmSchema.parse({ token, newPassword: 'AnotherSafePassword123' }).token).toBe(token);
    expect(() => passwordResetConfirmSchema.parse({ token, newPassword: 'weak' })).toThrow();
  });

  it('limits profile updates to safe self-service fields', () => {
    expect(profileUpdateSchema.parse({ firstName: 'Amina', phoneE164: null })).toEqual({ firstName: 'Amina', phoneE164: null });
    expect(() => profileUpdateSchema.parse({ email: 'new@example.com' })).toThrow();
    expect(() => profileUpdateSchema.parse({ status: 'ACTIVE' })).toThrow();
    expect(() => profileUpdateSchema.parse({})).toThrow();
  });
});
