# ArewaXpressMart API

## Backend runtime

`src/server.ts` is the only supported server entry point. Use `npm run dev` for development or `npm run build && npm start` for the compiled server. The archived `public/` prototype is not served by this application, and the retired in-memory server must not be launched.

The API prefix is `/api/v1`.

## Authentication module (current implementation)

Implemented endpoints are under `/api/v1/auth`:

- `POST /register`, `POST /email-verifications`, `POST /email-verifications/confirm`
- `POST /login`, `POST /google`, `POST /token`, `POST /logout`
- `GET /me`

The module uses PostgreSQL through Prisma, bcrypt password hashes, 15-minute access JWTs by default, rotating hashed refresh cookies, and token-reuse family revocation. During development, verification tokens are emitted to the server log. Replace `ConsoleEmailSender` with the notification module's provider-backed adapter before production deployment.

## Local setup

1. Copy `.env.example` to `.env` and set secrets.
2. Create the PostgreSQL database named in `DATABASE_URL`.
3. Run `npm install`, then `npm run prisma:generate`.
4. Apply committed migrations with `npx prisma migrate deploy`, then run `npx prisma db seed`.
5. Start development with `npm run dev`.

The seed provides deterministic Nigerian reference data (all states/FCT and representative cities), an SME category tree, development brands, and internal development shipping methods. It is safe to rerun. Optional marketplace fixtures are enabled only outside production with `SEED_DEVELOPMENT_FIXTURES=true` and the development-only `SEED_ADMIN_PASSWORD`/`SEED_SELLER_PASSWORD` variables (12+ characters); never set these fixture flags in production.

Permission-protected catalog administration is available under `/api/v1/admin/categories` and `/api/v1/admin/brands` using the `catalog:manage` permission. Shipping records are lookup data only; no carrier API or live rates are provided.

Run `npm test` for deterministic unit/schema tests and `npm run build` for TypeScript compilation. Database-backed tests must use a disposable PostgreSQL URL such as `apps/backend/.env.test.example`.
