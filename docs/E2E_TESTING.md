# End-to-end smoke tests

Set `E2E_BASE_URL` to an isolated staging or local deployment and run:

```bash
npm run test:e2e
```

The smoke suite is skipped when the variable is absent, so normal unit validation never requires a database, credentials, or external providers. It performs read-only checks for liveness, readiness, correlation IDs, and unauthenticated protection of metrics and order routes.

Authenticated commerce journeys, payment-provider callbacks, browser automation, load testing, and fixture provisioning remain separate follow-up work.

Database-backed integration tests must use a dedicated disposable PostgreSQL database. The example is `apps/backend/.env.test.example`; never point tests at staging or production.
