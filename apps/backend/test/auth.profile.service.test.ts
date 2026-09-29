import { describe, expect, it, vi } from 'vitest';

describe('AuthService profile updates', () => {
  it('updates only the authenticated user through the repository boundary', async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/arewaexpressmart_test';
    process.env.WEB_ORIGIN ??= 'http://localhost:5173';
    process.env.JWT_ISSUER ??= 'test';
    process.env.JWT_AUDIENCE ??= 'test';
    process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    const { AuthService } = await import('../src/modules/identity/application/AuthService.js');
    const updateUserProfile = vi.fn(async (userId: string, input: unknown) => ({
      id: userId, email: 'customer@example.com', firstName: 'Amina', lastName: 'Yusuf', passwordHash: null,
      emailVerifiedAt: new Date(), status: 'ACTIVE', roles: ['CUSTOMER'], permissions: [], ...input as object,
    }));
    const service = new AuthService({ updateUserProfile } as never, {} as never);
    await expect(service.updateProfile('user-1', { firstName: 'Amina' })).resolves.toMatchObject({ id: 'user-1', firstName: 'Amina' });
    expect(updateUserProfile).toHaveBeenCalledWith('user-1', { firstName: 'Amina' });
  });
});
