import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../../../config/env.js';

export const ANONYMOUS_CART_COOKIE = 'axm_cart';

export function createAnonymousCartToken(): string { return randomBytes(48).toString('base64url'); }
export function hashAnonymousCartToken(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function readAnonymousCartToken(req: Request): string | undefined {
  const value = req.cookies[ANONYMOUS_CART_COOKIE];
  return typeof value === 'string' && value.length >= 32 ? value : undefined;
}
export function setAnonymousCartCookie(res: Response, value: string): void {
  res.cookie(ANONYMOUS_CART_COOKIE, value, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1', maxAge: env.ANONYMOUS_CART_TTL_DAYS * 86_400_000 });
}
export function clearAnonymousCartCookie(res: Response): void {
  res.clearCookie(ANONYMOUS_CART_COOKIE, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1' });
}
