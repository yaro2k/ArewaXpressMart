# ArewaExpressMart customer frontend

This React + Vite application is the customer shopping foundation. It uses the authoritative backend at `apps/backend` and covers authentication, email verification, public catalog browsing, and carts for anonymous and authenticated customers. The browser keeps the anonymous cart in an HttpOnly backend cookie; a successful login automatically merges it into the authenticated cart. If current availability prevents a merge, the signed-in customer can resolve that cookie-bound cart in `/cart` and retry without logging out. Expired identifiers return an empty cart and rotate to a fresh token only when a new anonymous cart is created. Checkout, orders, payments, returns, invoices, notifications, seller, and admin interfaces remain future milestones.

## Local development

```sh
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_BASE_URL` to the backend API prefix (default: `http://localhost:4000/api/v1`). The backend must be running with a compatible `WEB_ORIGIN` and database. Run `npm test`, `npm run typecheck`, and `npm run build` for validation.

The customer flow now includes `/addresses`, `/checkout`, `/orders`, `/orders/:orderId`, invoice and return views, `/notifications`, `/profile`, and address editing. It uses the backend’s read-only location lookups to submit validated `cityId` values. Quote, order, invoice, and return monetary values are always rendered from backend responses. Payment and fulfilment statuses are displayed only as server-provided states; no provider integrations are simulated.

The frontend never stores refresh tokens. The backend refresh cookie remains HttpOnly; access tokens are held in memory only and are refreshed through `/auth/token` when an authenticated request expires.

Money is formatted by `src/money.ts` from server-provided integer minor units and currency codes. The current cart response provides item prices but no authoritative subtotal/total fields, so the frontend intentionally does not invent or calculate cart totals. Product image storage keys are treated as URLs only when usable; missing or failed images receive an accessible fallback.
