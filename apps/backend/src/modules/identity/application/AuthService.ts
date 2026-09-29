import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { AuthRepository, AuthUser } from '../domain/AuthRepository.js';

export interface EmailSender { sendVerification(input: { email: string; token: string; expiresAt: Date }): Promise<void>; }

export class ConsoleEmailSender implements EmailSender {
  async sendVerification(input: { email: string; token: string; expiresAt: Date }): Promise<void> {
    // The notification module will replace this adapter with an SES provider; never log tokens in production.
    if (env.NODE_ENV !== 'production') console.info(`Email verification for ${input.email}: token=${input.token}; expires=${input.expiresAt.toISOString()}`);
  }
}

export interface AuthResult { accessToken: string; expiresIn: number; user: ReturnType<AuthService['toPublicUser']>; refreshToken: string; }

export class AuthService {
  private readonly key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  private readonly googleClient = new OAuth2Client();

  constructor(private readonly repository: AuthRepository, private readonly emailSender: EmailSender) {}

  async register(input: { email: string; password: string; firstName: string; lastName: string; phoneE164?: string }): Promise<{ id: string; email: string; status: string }> {
    const { password, ...userInput } = input;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.repository.createPasswordUser({ ...userInput, email: input.email.toLowerCase(), passwordHash });
    await this.createAndSendVerification(user);
    return { id: user.id, email: user.email, status: user.status };
  }

  async resendVerification(email: string): Promise<void> { const user = await this.repository.findUserByEmail(email.toLowerCase()); if (user && !user.emailVerifiedAt) await this.createAndSendVerification(user); }
  async verifyEmail(token: string): Promise<ReturnType<AuthService['toPublicUser']>> { const user = await this.repository.consumeVerificationToken(hash(token), new Date()); if (!user) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'The verification link is invalid or expired.'); return this.toPublicUser(user); }
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email.toLowerCase());
    if (!user || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') return;
    const token = randomToken();
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    await this.repository.createPasswordResetToken(user.id, hash(token), expiresAt);
    if (env.NODE_ENV !== 'production') console.info(`Password reset for ${user.email}: token=${token}; expires=${expiresAt.toISOString()}`);
  }
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const user = await this.repository.resetPassword(hash(token), await bcrypt.hash(newPassword, 12), new Date());
    if (!user) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'The password reset link is invalid or expired.');
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email.toLowerCase());
    if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password.');
    this.assertCanAuthenticate(user);
    return this.createSession(user);
  }

  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, 'GOOGLE_LOGIN_UNAVAILABLE', 'Google login is not configured.');
    let payload;
    try { payload = (await this.googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID })).getPayload(); }
    catch { throw new AppError(401, 'UNAUTHENTICATED', 'Google token verification failed.'); }
    if (!payload?.sub || !payload.email || !payload.email_verified) throw new AppError(401, 'UNAUTHENTICATED', 'Google did not provide a verified identity.');
    let user = await this.repository.findUserByIdentity('google', payload.sub);
    if (!user) user = await this.repository.createGoogleUser({ subject: payload.sub, email: payload.email.toLowerCase(), firstName: payload.given_name ?? 'Google', lastName: payload.family_name ?? 'User' });
    this.assertCanAuthenticate(user);
    return this.createSession(user);
  }

  async refresh(rawToken: string): Promise<AuthResult> {
    const record = await this.repository.findRefreshToken(hash(rawToken));
    if (!record || record.expiresAt <= new Date()) throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is invalid or expired.');
    if (record.revokedAt) { await this.repository.revokeRefreshFamily(record.familyId); throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Session revoked. Sign in again.'); }
    this.assertCanAuthenticate(record.user);
    const refreshToken = randomToken();
    await this.repository.rotateRefreshToken({ oldId: record.id, familyId: record.familyId, userId: record.userId, tokenHash: hash(refreshToken), expiresAt: refreshExpiry() });
    return { accessToken: await this.createAccessToken(record.user), expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, user: this.toPublicUser(record.user), refreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> { if (!rawToken) return; const record = await this.repository.findRefreshToken(hash(rawToken)); if (record) await this.repository.revokeRefreshFamily(record.familyId); }
  async getMe(userId: string): Promise<ReturnType<AuthService['toPublicUser']>> { const user = await this.repository.findUserById(userId); if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists.'); return this.toPublicUser(user); }
  async updateProfile(userId: string, input: { firstName?: string; lastName?: string; phoneE164?: string | null }): Promise<ReturnType<AuthService['toPublicUser']>> {
    return this.toPublicUser(await this.repository.updateUserProfile(userId, input));
  }

  async authenticateAccessToken(token: string): Promise<{ userId: string; roles: string[]; permissions: string[] }> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
      if (typeof payload.sub !== 'string' || !Array.isArray(payload.roles) || !Array.isArray(payload.permissions)) throw new Error('Invalid claims');
      return { userId: payload.sub, roles: payload.roles.filter((x): x is string => typeof x === 'string'), permissions: payload.permissions.filter((x): x is string => typeof x === 'string') };
    } catch { throw new AppError(401, 'UNAUTHENTICATED', 'Access token is invalid or expired.'); }
  }

  toPublicUser(user: AuthUser) { return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null, status: user.status, roles: user.roles, permissions: user.permissions }; }

  private async createAndSendVerification(user: AuthUser): Promise<void> { const token = randomToken(); const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60_000); await this.repository.createVerificationToken(user.id, hash(token), expiresAt); await this.emailSender.sendVerification({ email: user.email, token, expiresAt }); }
  private assertCanAuthenticate(user: AuthUser): void { if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.'); if (!user.emailVerifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.'); }
  private async createSession(user: AuthUser): Promise<AuthResult> { const refreshToken = randomToken(); await this.repository.createRefreshToken({ userId: user.id, familyId: randomUUID(), tokenHash: hash(refreshToken), expiresAt: refreshExpiry() }); return { accessToken: await this.createAccessToken(user), expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, user: this.toPublicUser(user), refreshToken }; }
  private async createAccessToken(user: AuthUser): Promise<string> { return new SignJWT({ roles: user.roles, permissions: user.permissions }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setIssuedAt().setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`).sign(this.key); }
}

function randomToken(): string { return randomBytes(48).toString('base64url'); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function refreshExpiry(): Date { return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000); }
