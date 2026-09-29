export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  emailVerifiedAt: Date | null;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
}

export interface AuthRepository {
  createPasswordUser(input: { email: string; passwordHash: string; firstName: string; lastName: string; phoneE164?: string }): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  updateUserProfile(userId: string, input: { firstName?: string; lastName?: string; phoneE164?: string | null }): Promise<AuthUser>;
  findUserByIdentity(provider: string, subject: string): Promise<AuthUser | null>;
  createGoogleUser(input: { email: string; firstName: string; lastName: string; subject: string }): Promise<AuthUser>;
  createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeVerificationToken(tokenHash: string, now: Date): Promise<AuthUser | null>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<AuthUser | null>;
  createRefreshToken(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshTokenRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(input: { oldId: string; familyId: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  revokeRefreshFamily(familyId: string): Promise<void>;
}
