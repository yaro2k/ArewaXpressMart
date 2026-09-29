# ArewaXpressMart

ArewaXpressMart is a Nigerian multi-vendor marketplace backend. It is being built as a TypeScript REST API backed by PostgreSQL and Prisma.

The authoritative backend entry points are `apps/backend/src/server.ts` and `apps/backend/src/app.ts`. The archived prototype under `apps/backend/public` is not the marketplace frontend or API runtime.

## Current implementation

- Account registration and email verification
- Password login, Google ID-token login, and authenticated `GET /api/v1/auth/me`
- Short-lived JWT access tokens with rotating, hashed refresh-token cookies
- Role and permission claims in access tokens
- Seller applications and seller profile management
- Verified-seller store creation and store management
- Public active-store lookup
- Liveness and database-readiness health checks

The database schema includes foundations for brands, categories, products, variants, inventory, orders, payments, and fulfilment. Some documented capabilities remain incomplete or provider-boundary only.

Database bootstrap is deterministic and repeatable: `npx prisma db seed` loads Nigerian geographic lookups, catalog categories/brands, and internal development shipping methods. Development marketplace fixtures are opt-in (`SEED_DEVELOPMENT_FIXTURES=true` with environment-supplied development passwords) and are refused in production. Catalog administration is exposed through permission-protected `/api/v1/admin/categories` and `/api/v1/admin/brands` APIs; no admin UI is included yet.

The customer frontend is in `apps/frontend` and uses React + Vite. Run `npm install && npm run dev` there after copying `.env.example`; set `VITE_API_BASE_URL` to `/api/v1` on the running backend. Its current scope is authentication, email verification, product discovery, and cart management. Checkout, orders, payments, seller/admin screens, and other lifecycle views are intentionally deferred.

## Planned next work

1. Application foundation cleanup and integration testing
2. Catalog/bootstrap and administration completion
3. Customer, seller, and admin frontend applications
4. Payment, email, and shipping provider integrations
5. Full end-to-end validation and production hardening

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Run the API

```bash
cd apps/backend
cp .env.example .env
# Set a secure JWT_ACCESS_SECRET and confirm DATABASE_URL points to a local database.
npm install
npm run prisma:generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

The API listens on `http://localhost:4000` by default. Use `npm test` for unit/schema tests, `npm run build` for TypeScript compilation, and `npm start` after building for the compiled production-like server. API routes use the `/api/v1` prefix. Database-backed tests must use a disposable database described by `apps/backend/.env.test.example`; never use staging or production.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API specification](docs/API_SPECIFICATION.md)

The API specification describes both implemented endpoints and the intended marketplace API surface. Check the **Current implementation** section above for what is available today.
