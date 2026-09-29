import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AuthService } from '../application/AuthService.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/domain/AppError.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import { emailSchema, googleSchema, loginSchema, passwordResetConfirmSchema, profileUpdateSchema, registerSchema, tokenSchema } from './auth.schemas.js';

const REFRESH_COOKIE = 'axm_refresh';
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  router.post('/register', asyncRoute(async (req, res) => { const body = registerSchema.parse(req.body); const user = await authService.register(body); res.status(201).json({ data: { userId: user.id, email: user.email, status: user.status } }); }));
  router.post('/email-verifications', asyncRoute(async (req, res) => { const { email } = emailSchema.parse(req.body); await authService.resendVerification(email); res.status(202).json({ data: { accepted: true } }); }));
  router.post('/email-verifications/confirm', asyncRoute(async (req, res) => { const { token } = tokenSchema.parse(req.body); res.json({ data: { user: await authService.verifyEmail(token) } }); }));
  router.post('/password-resets', asyncRoute(async (req, res) => { const { email } = emailSchema.parse(req.body); await authService.requestPasswordReset(email); res.status(202).json({ data: { accepted: true } }); }));
  router.post('/password-resets/confirm', asyncRoute(async (req, res) => { const { token, newPassword } = passwordResetConfirmSchema.parse(req.body); await authService.confirmPasswordReset(token, newPassword); res.status(204).end(); }));
  router.post('/login', asyncRoute(async (req, res) => { const result = await authService.login(loginSchema.parse(req.body)); setRefreshCookie(res, result.refreshToken); res.json({ data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user } }); }));
  router.post('/google', asyncRoute(async (req, res) => { const result = await authService.loginWithGoogle(googleSchema.parse(req.body).idToken); setRefreshCookie(res, result.refreshToken); res.json({ data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user } }); }));
  router.post('/token', asyncRoute(async (req, res) => { assertSameOrigin(req); const rawToken = req.cookies[REFRESH_COOKIE] as string | undefined; if (!rawToken) throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is missing.'); const result = await authService.refresh(rawToken); setRefreshCookie(res, result.refreshToken); res.json({ data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user } }); }));
  router.post('/logout', asyncRoute(async (req, res) => { assertSameOrigin(req); await authService.logout(req.cookies[REFRESH_COOKIE] as string | undefined); clearRefreshCookie(res); res.status(204).end(); }));
  router.get('/me', requireAuthentication(authService), asyncRoute(async (req, res) => { res.json({ data: await authService.getMe(req.principal!.userId) }); }));
  router.patch('/me', requireAuthentication(authService), asyncRoute(async (req, res) => { res.json({ data: await authService.updateProfile(req.principal!.userId, profileUpdateSchema.parse(req.body)) }); }));
  return router;
}

function setRefreshCookie(res: Response, value: string): void { res.cookie(REFRESH_COOKIE, value, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1/auth', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 }); }
function clearRefreshCookie(res: Response): void { res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1/auth' }); }
function assertSameOrigin(req: Request): void { const origin = req.header('origin'); if (origin && origin !== env.WEB_ORIGIN) throw new AppError(403, 'CSRF_ORIGIN_REJECTED', 'Request origin is not allowed.'); }
