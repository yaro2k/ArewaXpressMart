import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/domain/AppError.js';
import type { AuthRepository, AuthUser, RefreshTokenRecord } from '../domain/AuthRepository.js';

const userInclude = { status: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } satisfies Prisma.UserInclude;

function mapUser(user: Prisma.UserGetPayload<{ include: typeof userInclude }>): AuthUser {
  return {
    id: user.id, email: user.email, passwordHash: user.passwordHash, firstName: user.firstName, lastName: user.lastName,
    emailVerifiedAt: user.emailVerifiedAt, status: user.status.code,
    roles: user.roles.map(({ role }) => role.code),
    permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))],
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async createPasswordUser(input: { email: string; passwordHash: string; firstName: string; lastName: string; phoneE164?: string }): Promise<AuthUser> {
    try {
      const user = await this.db.user.create({
        data: { ...input, status: { connect: { code: 'PENDING_VERIFICATION' } }, roles: { create: { role: { connect: { code: 'CUSTOMER' } } } } },
        include: userInclude,
      });
      return mapUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'An account already uses this email or phone number.');
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> { const user = await this.db.user.findUnique({ where: { email }, include: userInclude }); return user ? mapUser(user) : null; }
  async findUserById(id: string): Promise<AuthUser | null> { const user = await this.db.user.findUnique({ where: { id }, include: userInclude }); return user ? mapUser(user) : null; }
  async updateUserProfile(userId: string, input: { firstName?: string; lastName?: string; phoneE164?: string | null }): Promise<AuthUser> {
    try {
      return mapUser(await this.db.user.update({ where: { id: userId }, data: input, include: userInclude }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_RESOURCE', 'That phone number is already in use.');
      throw error;
    }
  }
  async findUserByIdentity(provider: string, subject: string): Promise<AuthUser | null> { const identity = await this.db.authIdentity.findUnique({ where: { provider_providerSubject: { provider, providerSubject: subject } }, include: { user: { include: userInclude } } }); return identity ? mapUser(identity.user) : null; }

  async createGoogleUser(input: { email: string; firstName: string; lastName: string; subject: string }): Promise<AuthUser> {
    try {
      const user = await this.db.user.create({
        data: { email: input.email, firstName: input.firstName, lastName: input.lastName, emailVerifiedAt: new Date(), status: { connect: { code: 'ACTIVE' } }, roles: { create: { role: { connect: { code: 'CUSTOMER' } } } }, identities: { create: { provider: 'google', providerSubject: input.subject, providerEmail: input.email } } },
        include: userInclude,
      });
      return mapUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'IDENTITY_CONFLICT', 'This Google identity or email is already linked to an account.');
      throw error;
    }
  }

  async createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> { await this.db.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } }); }
  async consumeVerificationToken(tokenHash: string, now: Date): Promise<AuthUser | null> {
    return this.db.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: { include: userInclude } } });
      if (!token || token.usedAt || token.expiresAt <= now) return null;
      await tx.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: now } });
      const user = await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now, status: { connect: { code: 'ACTIVE' } } }, include: userInclude });
      return mapUser(user);
    });
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<AuthUser | null> {
    return this.db.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { include: userInclude } } });
      if (!token || token.usedAt || token.expiresAt <= now) return null;
      await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: now } });
      const user = await tx.user.update({ where: { id: token.userId }, data: { passwordHash }, include: userInclude });
      return mapUser(user);
    });
  }

  async createRefreshToken(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshTokenRecord> {
    const token = await this.db.refreshToken.create({ data: input, include: { user: { include: userInclude } } });
    return { ...token, user: mapUser(token.user) };
  }
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> { const token = await this.db.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: userInclude } } }); return token ? { ...token, user: mapUser(token.user) } : null; }
  async rotateRefreshToken(input: { oldId: string; familyId: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> { await this.db.$transaction([this.db.refreshToken.update({ where: { id: input.oldId }, data: { revokedAt: new Date() } }), this.db.refreshToken.create({ data: { userId: input.userId, familyId: input.familyId, tokenHash: input.tokenHash, expiresAt: input.expiresAt } })]); }
  async revokeRefreshFamily(familyId: string): Promise<void> { await this.db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }); }
}
