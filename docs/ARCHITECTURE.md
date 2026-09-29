# ArewaXpressMart Architecture

## Runtime entry point

The authoritative application is the TypeScript/Prisma backend. Run `npm run dev` from `apps/backend` for development, or `npm run build && npm start` for the compiled server. Archived prototype assets are not the production frontend and are not served by the API.

## 1. Architectural decision

ArewaXpressMart will begin as a **modular monolith** in a TypeScript monorepo. Each business capability is isolated behind explicit domain, application, infrastructure, and presentation boundaries. This gives the team transactional consistency and fast delivery early on, while allowing high-volume modules to be extracted into services later without rewriting business rules.

The initial deployable units are:

```text
Browser -> CloudFront -> React web/admin apps -> ALB -> Express API -> PostgreSQL
                                                       |-> Redis / job workers
                                                       |-> S3 (private media)
                                                       |-> Stripe / Paystack
                                                       |-> Email / SMS providers
```

PostgreSQL is the system of record. Redis is used for caching, rate limiting, distributed locks, sessions/refresh-token lookup where useful, and queued work. API instances and workers are stateless and horizontally scalable.

## 2. Monorepo layout

```text
arewaxpressmart/
├── apps/
│   ├── web/                 # Customer React application
│   ├── admin/               # Admin React application
│   ├── api/                 # Express REST API
│   └── worker/              # Background jobs and event consumers
├── packages/
│   ├── contracts/           # Versioned API DTOs and shared validation schemas
│   ├── config/              # ESLint, TypeScript, Tailwind presets
│   └── ui/                  # Shared, accessible React UI primitives
├── infrastructure/
│   ├── docker/
│   └── aws/
├── docs/
└── .github/workflows/
```

Use npm workspaces initially. A task runner such as Turborepo may be added when build and test times warrant it.

## 3. Backend structure

The API follows Clean Architecture with MVC as the HTTP delivery layer. Dependencies point inwards; Express, Prisma, payment providers, and AWS SDKs stay at the edge.

```text
apps/api/src/
├── modules/
│   └── catalog/
│       ├── domain/              # Entities, value objects, repository interfaces
│       ├── application/         # Use cases, commands/queries, DTO mapping
│       ├── infrastructure/      # Prisma repositories, external adapters
│       └── presentation/        # Routes, controllers, request validation
├── shared/
│   ├── domain/                  # Errors, result types, domain events
│   ├── infrastructure/          # Prisma client, logger, cache, configuration
│   └── presentation/            # Middleware, response and error handlers
├── container/                   # Dependency-injection registrations
├── app.ts
└── server.ts
```

For every module, controllers only translate HTTP input/output; use cases enforce business rules; repository interfaces live in `domain`; Prisma implementations live in `infrastructure`. This makes providers replaceable and keeps tests independent of Express and PostgreSQL.

## 4. Bounded modules

| Module | Responsibility | Initial priority |
|---|---|---|
| Identity & access | Accounts, RBAC, JWT rotation, verification, Google OAuth | 1 |
| Catalog | Products, categories, variants, inventory, search read models | 2 |
| Seller | Onboarding, store profile, verification, listings | 2 |
| Cart & checkout | Carts, addresses, shipping quotes, order creation | 3 |
| Payments | Stripe/Paystack adapter, webhook reconciliation, refunds | 3 |
| Orders & fulfilment | Order state machine, shipments, returns | 3 |
| Notifications | Email/SMS templates and asynchronous delivery | 4 |
| Admin | Moderation, reports, roles, audit logs | 4 |

Roles are `CUSTOMER`, `SELLER`, `SUPPORT`, and `ADMIN`; permissions are explicit rather than scattering role checks in controllers.

## 5. Data and integration rules

- Prisma owns PostgreSQL schema migrations. Tables use UUID primary keys, `createdAt`, `updatedAt`, and appropriate unique/index constraints.
- Money is stored as integer minor units plus ISO currency (for example, `NGN`), never floating point.
- Inventory changes are transactional and protected by optimistic concurrency or row locks.
- Payment webhooks are signature-verified, idempotent, persisted, and processed asynchronously. A payment provider can never directly mark an order paid without server-side verification.
- Write the domain event and outbox row in the same database transaction. Workers publish/send after commit, enabling reliable email, SMS, payment reconciliation, and search indexing.
- Product media is uploaded by presigned S3 URLs; database records store metadata and object keys only. CloudFront serves public product media; private objects use signed URLs.
- Start with PostgreSQL full-text search; introduce OpenSearch only when catalog query volume and relevance needs justify it.

## 6. API conventions

- REST endpoints are versioned under `/api/v1` and use plural resources, e.g. `GET /products`, `POST /orders`.
- Requests are validated at the boundary using shared schemas. Unknown fields are rejected for write endpoints.
- Responses use a consistent envelope: `{ "data": ... }`; errors use RFC 9457-style problem details with a stable `code`.
- List endpoints use cursor pagination, explicit sort/filter allow-lists, and a bounded page size.
- Mutating payment/checkout endpoints require an `Idempotency-Key`.
- Authentication uses short-lived access JWTs plus rotating, hashed refresh tokens in secure, `HttpOnly`, `SameSite` cookies. Token reuse revokes the token family.
- Enforce RBAC, ownership checks, rate limits, CORS allow-lists, request-size limits, Helmet, structured logs, and correlation IDs.

## 7. Scale, reliability, and operations

The initial AWS topology is an ALB in front of multiple Dockerized API and worker instances on EC2, backed by managed PostgreSQL (RDS) and Redis (ElastiCache). S3 and CloudFront handle media and frontend delivery. Secrets live in AWS Secrets Manager or SSM Parameter Store, never in GitHub or Docker images.

Prepare from day one for horizontal scaling: no process memory for carts, sessions, queues, or scheduled tasks. Add read replicas, partition high-volume append-only tables (events/audit logs), and extract modules such as search, notification delivery, and payment processing only when monitoring demonstrates the need.

CI uses GitHub Actions to run type checks, linting, unit/integration tests, Prisma migration validation, container builds, dependency/security scanning, and staged deployment. Production requires automated backups, point-in-time recovery, health/readiness endpoints, metrics, tracing, alerting, and an audit log for privileged actions.

## 8. Delivery sequence

1. **Foundation:** TypeScript monorepo, Docker local environment, API skeleton, lint/test tooling, Prisma connection, configuration and observability.
2. **Identity:** User schema, registration, email verification, login/logout, refresh rotation, Google login, RBAC.
3. **Catalog and seller:** Categories, products/variants, inventory, S3 uploads, seller onboarding and moderation.
4. **Commerce:** Cart, address, shipping abstraction, order state machine, Stripe and Paystack checkout/webhooks.
5. **Operations:** Notifications, admin dashboard, audit logs, reports, CI/CD and AWS hardening.

The next implementation step is Phase 1: scaffold the monorepo and production API foundation. No business feature will be built until it has the shared validation, error handling, configuration, and test seams needed to support it safely.

## 9. Complete folder structure

```text
arewaxpressmart/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/
│   │   │   │   ├── users/
│   │   │   │   ├── catalog/
│   │   │   │   ├── seller/
│   │   │   │   ├── cart/
│   │   │   │   ├── checkout/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── media/
│   │   │   │   ├── notifications/
│   │   │   │   └── admin/
│   │   │   ├── shared/
│   │   │   │   ├── domain/          # Base types, errors, events
│   │   │   │   ├── application/     # Ports, pagination, result types
│   │   │   │   ├── infrastructure/  # Prisma, Redis, logger, providers
│   │   │   │   └── presentation/    # Middleware and HTTP utilities
│   │   │   ├── container/            # Composition root/DI bindings
│   │   │   ├── routes.ts
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── test/                     # API integration and contract tests
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── worker/
│   │   ├── src/jobs/                 # Outbox, notifications, media, search
│   │   ├── src/consumers/
│   │   ├── src/container/
│   │   ├── src/worker.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── web/
│   │   └── src/
│   │       ├── app/                  # Router, Redux store, providers
│   │       ├── features/             # Feature-local pages, state and API hooks
│   │       ├── components/           # Reusable composites
│   │       ├── routes/
│   │       ├── services/             # Axios client/interceptors
│   │       └── styles/
│   └── admin/                        # Same frontend structure, admin routes
├── packages/
│   ├── contracts/src/                # DTOs, API error codes, Zod schemas
│   ├── ui/src/                       # Design system components
│   ├── config/                       # TS/ESLint/Tailwind shared configuration
│   └── test-utils/
├── infrastructure/
│   ├── docker/                       # docker-compose and local service config
│   └── aws/                          # IaC: networking, RDS, EC2, S3, CloudFront
├── docs/
├── .github/workflows/
├── package.json
├── tsconfig.base.json
└── README.md
```

## 10. Standard module structure

Every API module has the same shape. A module may only depend on another module's public application interface or published event, never on its Prisma implementation.

```text
modules/orders/
├── domain/
│   ├── entities/Order.ts
│   ├── value-objects/Money.ts
│   ├── events/OrderPlaced.ts
│   └── repositories/OrderRepository.ts       # Interface (port)
├── application/
│   ├── commands/PlaceOrder.ts
│   ├── queries/GetOrder.ts
│   ├── use-cases/PlaceOrderUseCase.ts
│   ├── dto/OrderDto.ts
│   └── ports/PaymentGateway.ts                # External interface (port)
├── infrastructure/
│   ├── persistence/PrismaOrderRepository.ts   # Adapter
│   └── messaging/OrderEventPublisher.ts
├── presentation/
│   ├── http/OrderController.ts
│   ├── http/order.routes.ts
│   └── http/order.schemas.ts
└── __tests__/
```

The composition root maps interfaces to adapters, e.g. `OrderRepository -> PrismaOrderRepository` and `PaymentGateway -> PaystackGateway`. Business use cases receive these interfaces via constructor injection. This enforces the Dependency Inversion Principle and keeps modules testable with fakes.

## 11. Request flow

```text
React page
  -> Axios client (access token and correlation ID)
  -> CloudFront / ALB
  -> Express global middleware
       (request ID, CORS, rate limit, auth extraction, validation)
  -> versioned router
  -> controller (HTTP-to-command mapping)
  -> use case (authorization and business rules)
  -> repository/interface ports
  -> Prisma/PostgreSQL and/or external adapter
  -> use case maps domain result to DTO
  -> controller returns HTTP response
  -> Axios response interceptor refreshes once on 401 when appropriate
  -> Redux Toolkit cache/state and React view update
```

Example: `POST /api/v1/cart/items` validates the request schema, resolves the authenticated user, runs `AddCartItemUseCase`, checks the catalog through its public query port, persists the cart through `CartRepository`, then returns the cart DTO. Controllers do not contain business rules or Prisma calls.

All unexpected errors go through one error middleware that logs context, maps known domain errors to stable problem responses, and never exposes stack traces. Read endpoints may use cache-aside Redis; mutations invalidate or update the relevant cache after a committed transaction.

## 12. Database flow

```text
Command -> Use case -> Prisma transaction
                       ├-> validate current state / lock inventory row
                       ├-> write aggregate tables
                       ├-> write audit log when required
                       └-> write outbox event
                    -> commit
                    -> response to client

Worker -> claims unpublished outbox rows -> performs provider action
       -> marks event delivered or schedules retry with backoff
```

Core relational aggregates are:

```text
User --< RefreshToken, Address, Cart, Order, Review
User --< SellerProfile --< Store --< Product --< ProductVariant --< Inventory
Product --< ProductImage; Product >--< Category
Cart --< CartItem
Order --< OrderItem, PaymentAttempt, Shipment, OrderStatusHistory
PaymentAttempt --< PaymentWebhookEvent
```

Key invariants:

- An `OrderItem` stores a product/variant snapshot, price, tax, discount, and seller at purchase time; historical orders must not change with catalog edits.
- A single checkout transaction reserves inventory, calculates immutable order totals, creates the order and `PaymentAttempt`, and emits `OrderCreated`.
- Payment confirmation uses conditional state transitions (`PENDING -> PAID`); duplicate webhooks or retries cannot double-charge, double-decrement stock, or create duplicate orders.
- Connection pooling is managed for API and worker concurrency. Frequently filtered foreign keys and cursor fields are indexed; migrations are backward-compatible and deployed before dependent code.

## 13. Authentication and authorization flow

```text
Register -> password hash (Argon2id) -> User(PENDING_VERIFICATION)
         -> outbox EmailVerificationRequested -> worker -> email with one-time token
Verify   -> token hash lookup and expiry check -> User(VERIFIED)

Login / Google OAuth callback
       -> user + role/permission lookup -> issue access JWT (short TTL)
       -> create hashed refresh-token record (family, expiry, device metadata)
       -> access token response + refresh token Secure HttpOnly cookie

API call -> verify access JWT -> attach principal -> route permission + ownership check

Refresh -> read cookie -> hash/lookup token -> rotate token and issue new access JWT
        -> revoke whole family and require login if a rotated token is reused

Logout  -> revoke refresh token/family -> clear cookie
```

Google authentication uses OAuth 2.0 authorization code flow with PKCE. The callback is validated for state and nonce, and the verified Google subject is linked to exactly one local user identity. Do not trust email claims without provider verification.

The browser keeps the short-lived access token in memory where possible; the refresh credential is not accessible to JavaScript. CSRF controls apply to cookie-authenticated refresh/logout endpoints. Admin routes additionally require an `ADMIN` permission, enforced server-side regardless of client routing.

## 14. Payment flow

`PaymentGateway` is an application port. `StripeGateway` and `PaystackGateway` are independent adapters; the rest of checkout does not branch on provider details.

```text
Customer clicks pay
  -> POST /checkout (Idempotency-Key)
  -> create/resume order and PaymentAttempt(PENDING) in transaction
  -> select Stripe or Paystack adapter by customer/currency configuration
  -> provider creates PaymentIntent/transaction
  -> API returns only provider checkout/client data to browser
  -> customer completes provider-hosted or provider SDK payment
  -> provider webhook -> POST /api/v1/webhooks/{provider}
  -> verify raw-body signature, deduplicate provider event ID
  -> queue reconciliation
  -> worker verifies transaction with provider API
  -> transactional PaymentAttempt(PAID), Order(PAID/PROCESSING), inventory finalization
  -> outbox OrderPaid -> notifications and seller fulfilment workflow
```

The success redirect is informational only; payment state is confirmed exclusively by verified webhook/reconciliation. Webhook endpoints are unauthenticated but narrowly rate-limited, signature-verified, idempotent, and retain the raw request body. Never log card, authorization, or secret data.

Refunds are initiated through an authorized admin/support use case, recorded as a new payment action, sent through the gateway, and finalized through verified webhook/reconciliation in the same manner.

## 15. Deployment architecture

```text
Internet
  |
Route 53
  |
CloudFront + AWS WAF
  |-- S3 private bucket: versioned web/admin build assets and product media
  |-- Application Load Balancer (public subnets, TLS via ACM)
          |
          +-- EC2 Auto Scaling Group (private subnets)
                 |-- API Docker containers (multiple instances / AZs)
                 |-- Worker Docker containers (separate scaling policy)
                 |
                 +-- RDS PostgreSQL Multi-AZ (private subnets)
                 +-- ElastiCache Redis (private subnets)

External: Stripe, Paystack, email provider, SMS provider, Google OAuth
Operations: CloudWatch logs/metrics/alarms, Secrets Manager, SSM, backups
```

CloudFront has separate cache behaviours for immutable frontend assets, public product media, and dynamic API paths (API is not cached unless an endpoint explicitly supports it). S3 is private with Origin Access Control; clients upload media using short-lived presigned URLs. The ALB only permits CloudFront/WAF traffic where feasible; EC2, RDS, and Redis have no public IPs.

GitHub Actions uses OpenID Connect to assume a limited AWS deployment role. On each protected-branch release it runs checks, builds immutable Docker images, pushes them to ECR, applies backwards-compatible migrations as a one-off task, then performs rolling or blue/green API deployment and smoke checks. Rollback restores the previous image—not a destructive database rollback.

### Environment separation

Maintain isolated AWS accounts or, initially, isolated VPCs/resources for `development`, `staging`, and `production`. Each has separate databases, S3 buckets, provider keys, OAuth callback URLs, and observability retention. Production access is least-privilege, audited, and uses break-glass procedures only.
