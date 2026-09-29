import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../../modules/identity/application/AuthService.js';
import { AppError } from '../domain/AppError.js';

declare global { namespace Express { interface Request { principal?: { userId: string; roles: string[]; permissions: string[] }; } } }

export function requireAuthentication(authService: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const [scheme, token] = req.header('authorization')?.split(' ') ?? [];
      if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'A bearer access token is required.');
      req.principal = await authService.authenticateAccessToken(token);
      next();
    } catch (error) { next(error); }
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal || !permissions.every((permission) => req.principal?.permissions.includes(permission))) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    next();
  };
}
