import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../../identity/application/AuthService.js';
import { requireAuthentication } from '../../../shared/presentation/auth.js';
import type { CatalogService } from '../application/CatalogService.js';
import { catalogSlugSchema, productCreateSchema, productImageCreateSchema, productQuerySchema, productUpdateSchema } from './catalog.schemas.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => { void handler(req, res).catch(next); };
const requiredParam = (value: string | string[] | undefined): string => { if (typeof value !== 'string' || !value) throw new Error('Required route parameter is missing.'); return value; };

export function createCatalogRouter(catalogService: CatalogService): Router {
  const router = Router();
  router.get('/categories', asyncRoute(async (_req, res) => { res.json({ data: await catalogService.listCategories() }); }));
  router.get('/categories/:slug', asyncRoute(async (req, res) => { res.json({ data: await catalogService.getCategory(catalogSlugSchema.parse(req.params).slug) }); }));
  router.get('/brands', asyncRoute(async (_req, res) => { res.json({ data: await catalogService.listBrands() }); }));
  router.get('/brands/:slug', asyncRoute(async (req, res) => { res.json({ data: await catalogService.getBrand(catalogSlugSchema.parse(req.params).slug) }); }));
  router.get('/products', asyncRoute(async (req, res) => { res.json({ data: await catalogService.listProducts(productQuerySchema.parse(req.query)) }); }));
  router.get('/products/:productIdOrSlug', asyncRoute(async (req, res) => { res.json({ data: await catalogService.getProduct(requiredParam(req.params.productIdOrSlug)) }); }));
  router.get('/stores/:slug/products', asyncRoute(async (req, res) => { res.json({ data: await catalogService.listStoreProducts(requiredParam(req.params.slug), productQuerySchema.parse(req.query)) }); }));
  return router;
}

export function createSellerProductRouter(authService: AuthService, catalogService: CatalogService): Router {
  const router = Router(); router.use(requireAuthentication(authService));
  router.get('/products', asyncRoute(async (req, res) => { res.json({ data: await catalogService.listSellerProducts(req.principal!.userId) }); }));
  router.post('/products', asyncRoute(async (req, res) => { res.status(201).json({ data: await catalogService.createProduct(req.principal!.userId, productCreateSchema.parse(req.body)) }); }));
  router.patch('/products/:productId', asyncRoute(async (req, res) => { res.json({ data: await catalogService.updateProduct(req.principal!.userId, requiredParam(req.params.productId), productUpdateSchema.parse(req.body)) }); }));
  router.delete('/products/:productId', asyncRoute(async (req, res) => { await catalogService.archiveProduct(req.principal!.userId, requiredParam(req.params.productId)); res.status(204).end(); }));
  router.post('/products/:productId/images', asyncRoute(async (req, res) => { res.status(201).json({ data: await catalogService.addProductImage(req.principal!.userId, requiredParam(req.params.productId), productImageCreateSchema.parse(req.body)) }); }));
  return router;
}
