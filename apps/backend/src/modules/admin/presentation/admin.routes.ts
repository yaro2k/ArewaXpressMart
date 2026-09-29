import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication, requirePermission } from '../../../shared/presentation/auth.js';
import { AppError } from '../../../shared/domain/AppError.js';
import type { AdminService } from '../application/AdminService.js';
import { brandCreateSchema, brandUpdateSchema, categoryCreateSchema, categoryUpdateSchema, productModerationSchema, sellerReviewSchema, userRolesSchema, userStatusSchema } from './admin.schemas.js';
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const param = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION_ERROR', 'A route parameter is required.'); return value; };
export function createAdminRouter(auth: AuthService, service: AdminService): Router {
  const router = Router(); router.use(requireAuthentication(auth));
  router.get('/categories', requirePermission('catalog:manage'), asyncRoute(async (_req, res) => { res.json({ data: await service.listCategories() }); }));
  router.get('/categories/:categoryId', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.json({ data: await service.getCategory(param(req.params.categoryId)) }); }));
  router.post('/categories', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.status(201).json({ data: await service.createCategory(req.principal!.userId, categoryCreateSchema.parse(req.body)) }); }));
  router.patch('/categories/:categoryId', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.json({ data: await service.updateCategory(req.principal!.userId, param(req.params.categoryId), categoryUpdateSchema.parse(req.body)) }); }));
  router.get('/brands', requirePermission('catalog:manage'), asyncRoute(async (_req, res) => { res.json({ data: await service.listBrands() }); }));
  router.get('/brands/:brandId', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.json({ data: await service.getBrand(param(req.params.brandId)) }); }));
  router.post('/brands', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.status(201).json({ data: await service.createBrand(req.principal!.userId, brandCreateSchema.parse(req.body)) }); }));
  router.patch('/brands/:brandId', requirePermission('catalog:manage'), asyncRoute(async (req, res) => { res.json({ data: await service.updateBrand(req.principal!.userId, param(req.params.brandId), brandUpdateSchema.parse(req.body)) }); }));
  router.get('/users', requirePermission('user:read:any'), asyncRoute(async (_req, res) => { res.json({ data: await service.listUsers() }); }));
  router.patch('/users/:userId/status', requirePermission('user:manage'), asyncRoute(async (req, res) => { const body = userStatusSchema.parse(req.body); res.json({ data: await service.updateUserStatus(req.principal!.userId, param(req.params.userId), body.status, body.reason) }); }));
  router.put('/users/:userId/roles', requirePermission('role:assign'), asyncRoute(async (req, res) => { const body = userRolesSchema.parse(req.body); res.json({ data: await service.replaceUserRoles(req.principal!.userId, param(req.params.userId), body.roleCodes) }); }));
  router.get('/seller-applications', requirePermission('seller:review'), asyncRoute(async (_req, res) => { res.json({ data: await service.listSellerApplications() }); }));
  router.patch('/seller-applications/:sellerId', requirePermission('seller:review'), asyncRoute(async (req, res) => { const body = sellerReviewSchema.parse(req.body); res.json({ data: await service.updateSellerApplication(req.principal!.userId, param(req.params.sellerId), body.verificationStatus, body.reason) }); }));
  router.patch('/products/:productId/status', requirePermission('product:moderate'), asyncRoute(async (req, res) => { const body = productModerationSchema.parse(req.body); res.json({ data: await service.moderateProduct(req.principal!.userId, param(req.params.productId), body.status, body.reason) }); }));
  router.get('/audit-logs', requirePermission('audit:read'), asyncRoute(async (_req, res) => { res.json({ data: await service.listAuditLogs() }); }));
  return router;
}
