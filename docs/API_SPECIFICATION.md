# REST API specification — v1

> This document includes both implemented and planned endpoints. The authoritative implementation is `apps/backend/src/server.ts` and the route files under `apps/backend/src/modules/**/presentation`. An endpoint is not available solely because it appears here. The API prefix is `/api/v1`.

Base URL: `/api/v1`. All JSON requests require `Content-Type: application/json`; all successful JSON responses use `{ "data": ... }`. Timestamps are ISO 8601 UTC, identifiers are UUIDs, and money uses integer minor units (`amountMinor`) plus `currency`. List responses are `{ "data": [], "meta": { "nextCursor": null } }`.

## Common security, validation, and errors

Catalog administration is implemented at `/api/v1/admin/categories` and `/api/v1/admin/brands` (list/detail/create/update) and requires the explicit `catalog:manage` permission. Category updates reject self/descendant cycles and duplicate slugs; brand/category mutations are audit logged. No admin frontend is included yet.

`Public` endpoints require no token. `Bearer` requires `Authorization: Bearer <access-jwt>`. Refresh tokens are sent only as a secure HttpOnly cookie. An authenticated caller must also pass the listed permission/ownership rule. All write requests reject unknown fields, validate UUIDs/formats and enforce business invariants in the use case.

| Status | Stable code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON, schema or business-input validation failed. |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` | Missing, invalid, expired, or revoked credential. |
| 403 | `FORBIDDEN` | Authenticated caller lacks required permission/ownership. |
| 404 | `NOT_FOUND` | Resource is missing or intentionally not disclosed. |
| 409 | `CONFLICT`, `DUPLICATE_RESOURCE`, `INVALID_STATE` | Unique conflict, stale version, invalid transition, duplicate review/redemption. |
| 422 | `INSUFFICIENT_INVENTORY`, `PAYMENT_NOT_SETTLED`, `COUPON_INELIGIBLE` | Valid request cannot be fulfilled under current business state. |
| 429 | `RATE_LIMITED` | Endpoint/IP/account rate limit exceeded. |
| 502/503 | `PROVIDER_UNAVAILABLE` | Verified external provider failure/unavailability. |

Error shape:

```json
{
  "type": "https://api.arewaxpressmart.com/problems/validation-error",
  "title": "Request validation failed",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "One or more fields are invalid.",
  "errors": [{ "field": "email", "message": "Must be a valid email address." }],
  "traceId": "01J..."
}
```

All collections accept bounded `limit` (1–100), `cursor`, and documented filters/sorts. `Idempotency-Key` is required for checkout, payment creation, refund creation, and other payment-affecting POSTs. Every endpoint may return the common errors above; endpoint-specific errors listed below are additive.

## Authentication and account

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `POST /auth/register` | `{email,password,firstName,lastName,phoneE164?}` | `201 {data:{userId,email,status:"PENDING_VERIFICATION"}}` | Public | Valid unique email, password policy, E.164 phone. `409 DUPLICATE_RESOURCE`, `429 RATE_LIMITED`. |
| `POST /auth/email-verifications` | `{email}` | `202 {data:{accepted:true}}` | Public | Valid email; response does not reveal account existence. `429 RATE_LIMITED`. |
| `POST /auth/email-verifications/confirm` | `{token}` | `200 {data:{user:{...}}}` | Public | One-time unexpired token. `400 VALIDATION_ERROR`, `409 INVALID_STATE`. |
| `POST /auth/login` | `{email,password}` | `200 {data:{accessToken,expiresIn,user}}` + refresh cookie | Public | Valid credentials, active/verified account. `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`, `429 RATE_LIMITED`. |
| `POST /auth/token` | refresh cookie only | `200 {data:{accessToken,expiresIn}}` + rotated cookie | Refresh cookie | Rotating token family; CSRF required. `401 UNAUTHENTICATED`, `409 TOKEN_REUSE_DETECTED`. |
| `POST /auth/logout` | refresh cookie only | `204` | Refresh cookie | Revokes current family/token; always safe to retry. |
| `GET /auth/google/authorize` | query `returnTo?` | `302` to Google | Public | Allow-listed return URL. `400 VALIDATION_ERROR`. |
| `GET /auth/google/callback` | provider query (`code`,`state`) | `302` to web app, sets refresh cookie | OAuth state/nonce | PKCE, state, nonce and verified Google claims. `401 UNAUTHENTICATED`, `409 IDENTITY_CONFLICT`. |
| `POST /auth/password-resets` | `{email}` | `202 {data:{accepted:true}}` | Public | Valid email; non-enumerating response. `429 RATE_LIMITED`. |
| `POST /auth/password-resets/confirm` | `{token,newPassword}` | `204` | Public | Valid one-time token and password policy; revokes refresh families. `400 VALIDATION_ERROR`, `409 INVALID_STATE`. |
| `GET /me` | — | `200 {data:{id,email,roles,permissions,...}}` | Bearer, self | `401`. |
| `PATCH /me` | `{firstName?,lastName?,phoneE164?}` | `200 {data:user}` | Bearer, self | Mutable profile fields only; unique phone. `409 DUPLICATE_RESOURCE`. |
| `GET /me/addresses` | pagination | `200 {data:[address]}` | Bearer, self | `401`. |
| `POST /me/addresses` | `{recipientName,phoneE164,line1,line2?,cityId,postalCode?,isDefaultShipping?,isDefaultBilling?}` | `201 {data:address}` | Bearer, self | Required delivery fields, valid city. `404 NOT_FOUND`. |
| `PATCH /me/addresses/:addressId` | Address mutable fields | `200 {data:address}` | Bearer, address owner | Address UUID; cannot edit an order snapshot. `403`, `404`. |
| `DELETE /me/addresses/:addressId` | — | `204` | Bearer, address owner | Cannot remove only required/default address without replacement. `409 INVALID_STATE`. |

## Public catalog, search, brands, and categories

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `GET /products` | `q?,category?,brand?,minPrice?,maxPrice?,sort?,cursor?,limit?` | `200 {data:[productCard],meta}` | Public | Allow-listed filters/sorts, numeric price bounds. `400 VALIDATION_ERROR`. |
| `GET /products/:productIdOrSlug` | — | `200 {data:productDetail}` | Public | Only active/public products returned. `404 NOT_FOUND`. |
| `GET /products/:productId/reviews` | `rating?,cursor?,limit?` | `200 {data:[review],meta}` | Public | Published reviews only; rating 1–5. |
| `GET /categories` | `parentId?` | `200 {data:[category]}` | Public | Valid UUID if supplied. |
| `GET /categories/:slug` | — | `200 {data:category}` | Public | Active category. `404`. |
| `GET /brands` | `q?,cursor?,limit?` | `200 {data:[brand],meta}` | Public | Bounded query. |
| `GET /brands/:slug` | — | `200 {data:brand}` | Public | `404`. |
| `GET /stores/:slug` | — | `200 {data:storeProfile}` | Public | Published store only. `404`. |
| `GET /stores/:slug/products` | filters/pagination | `200 {data:[productCard],meta}` | Public | Active store/products only. `404`. |

## Customer cart, wishlist, coupons, and reviews

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `GET /cart` | anonymous cart cookie or bearer | `200 {data:cart}` | Public/Bearer | Resolves one owner form. `401` only when an invalid bearer is sent. |
| `POST /cart/items` | `{productVariantId,quantity}` | `201 {data:cart}` | Public/Bearer | UUID; quantity 1–999; active SKU. `404`, `422 INSUFFICIENT_INVENTORY`. |
| `PATCH /cart/items/:cartItemId` | `{quantity}` | `200 {data:cart}` | Public/Bearer, cart owner | Positive bounded quantity. `403`, `404`, `422`. |
| `DELETE /cart/items/:cartItemId` | — | `204` | Public/Bearer, cart owner | `403`, `404`. |
| `POST /cart/merge` | anonymous cart cookie | `200 {data:cart}` | Bearer, self | Merges valid lines; availability is rechecked. `422 INSUFFICIENT_INVENTORY`. |
| `GET /wishlists` | — | `200 {data:[wishlist]}` | Bearer, self | `401`. |
| `POST /wishlists` | `{name,isDefault?}` | `201 {data:wishlist}` | Bearer, self | Name 1–80 chars; one default. `409 CONFLICT`. |
| `GET /wishlists/:wishlistId/items` | pagination | `200 {data:[productCard],meta}` | Bearer, owner | `403`, `404`. |
| `POST /wishlists/:wishlistId/items` | `{productId}` | `201 {data:wishlistItem}` | Bearer, owner | Active product; unique pair. `404`, `409 DUPLICATE_RESOURCE`. |
| `DELETE /wishlists/:wishlistId/items/:productId` | — | `204` | Bearer, owner | `403`, `404`. |
| `POST /coupons/validate` | `{code,cartId?}` | `200 {data:{coupon,estimatedDiscountMinor}}` | Public/Bearer | Normalized code; evaluates dates, scope, thresholds. `404`, `422 COUPON_INELIGIBLE`. |
| `POST /products/:productId/reviews` | `{rating,title?,body?}` | `201 {data:review}` | Bearer, verified buyer if configured | Rating 1–5; length limits; one review per eligible line. `403`, `409 DUPLICATE_RESOURCE`, `422 PAYMENT_NOT_SETTLED`. |
| `PATCH /reviews/:reviewId` | `{rating?,title?,body?}` | `200 {data:review}` | Bearer, review author | Only own pending/published review subject to policy. `403`, `404`, `409 INVALID_STATE`. |
| `DELETE /reviews/:reviewId` | — | `204` | Bearer, review author or `review:moderate` | `403`, `404`. |

## Checkout, orders, shipping, payments, returns, invoices

The customer address flow uses the read-only reference endpoints `GET /locations/countries`, `GET /locations/states?countryId=<uuid>`, and `GET /locations/cities?stateProvinceId=<uuid>`. Checkout currently accepts only `{shippingAddressId,billingAddressId?}`; shipping methods, coupons, and payment-provider parameters remain deferred from the implemented contract.

Customer post-purchase reads are available through `GET /orders`, `GET /orders/:orderId`, `GET /orders/:orderId/shipments`, `GET /orders/:orderId/invoice`, `GET /returns`, `GET /returns/:returnId`, and `GET/PATCH /me/notifications`. These remain ownership-protected and expose structured data only; invoice PDF generation and live carrier tracking are not implemented.

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `POST /checkout/quote` | `{cartId?,shippingAddressId,couponCode?,shippingMethodId?}` | `200 {data:{lines,totals,shippingOptions}}` | Bearer, cart/address owner | Address/cart ownership; all lines saleable. `404`, `422 INSUFFICIENT_INVENTORY`, `COUPON_INELIGIBLE`. |
| `POST /checkout` | `{shippingAddressId,billingAddressId?}` + `Idempotency-Key` | `201 {data:order}` | Bearer, self | Requotes and locks stock transactionally. `409 CONFLICT`, `422 INSUFFICIENT_INVENTORY`. |
| `GET /orders` | `status?,cursor?,limit?` | `200 {data:[orderSummary],meta}` | Bearer, self | Allow-listed status. |
| `GET /orders/:orderId` | — | `200 {data:orderDetail}` | Bearer, order owner or `order:read:any` | `403`, `404`. |
| `POST /orders/:orderId/cancel` | `{reason?}` | `200 {data:order}` | Bearer, order owner or `order:manage:any` | Only cancellable state and unshipped quantities. `409 INVALID_STATE`; refund may be pending. |
| `GET /orders/:orderId/shipments` | — | `200 {data:[shipment]}` | Bearer, owner or `order:read:any` | `403`, `404`. |
| `GET /shipping/methods` | `addressId,cartId?` | `200 {data:[shippingMethodQuote]}` | Bearer, address/cart owner | Valid serviceable address and cart. `422 SHIPPING_UNAVAILABLE`. |
| `POST /orders/:orderId/payments` | `{provider:"PAYSTACK"}` + `Idempotency-Key` | `201 {data:{paymentId,orderId,provider,status,providerReference,authorizationUrl?}}` | Bearer, order owner | Amount, currency, email, and reference are server-derived. `400`, `403`, `404`, `409`, `502`. Paystack initialization returns hosted checkout data when configured. |
| `GET /payments/:paymentId` | — | `200 {data:payment}` | Bearer, payment/order owner or `payment:read:any` | `403`, `404`. |
| `POST /webhooks/paystack` | Raw Paystack JSON body + `x-paystack-signature` | `204` | Paystack HMAC signature | Raw-body HMAC-SHA512, event deduplication, provider verification, amount/currency/reference matching. `400`, `401 INVALID_SIGNATURE`, `404`, `422 PAYMENT_MISMATCH`. |
| `POST /orders/:orderId/returns` | `{items:[{orderItemId,quantity,reasonCode}],note?}` | `201 {data:returnRequest}` | Bearer, order owner | Delivered, eligible, non-returned quantity; reason valid. `422 RETURN_INELIGIBLE`. |
| `GET /returns` | `cursor?,limit?` | `200 {data:[returnRequest],meta}` | Bearer, self; staff uses `/admin/returns` | `401`. |
| `GET /returns/:returnId` | — | `200 {data:returnRequest}` | Bearer, requester or `return:manage` | `403`, `404`. |
| `GET /orders/:orderId/invoice` | — | `200 {data:invoice}` | Bearer, owner or `invoice:read:any` | Invoice must be issued. `403`, `404`, `409 INVALID_STATE`. |
| `GET /orders/:orderId/invoice.pdf` | — | `200 application/pdf` | Bearer, owner or `invoice:read:any` | Same authorization; rate limited signed/download stream. |

## Seller APIs

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `POST /seller/applications` | `{legalName,storeName,storeSlug,contactAddressId,...}` | `201 {data:sellerProfile}` | Bearer, self | Active user, unique slug, required verification details. `409 DUPLICATE_RESOURCE`. |
| `GET /seller/profile` | — | `200 {data:sellerProfile}` | Bearer, seller owner | `403`. |
| `PATCH /seller/profile` | Allowed business/contact fields | `200 {data:sellerProfile}` | Bearer, seller owner | Cannot directly set verification/commission. `403`, `409 INVALID_STATE`. |
| `GET /seller/stores` | — | `200 {data:[store]}` | Bearer, seller owner | `403`. |
| `POST /seller/stores` | `{displayName,slug,addressId}` | `201 {data:store}` | Bearer, seller owner | Verified seller, unique slug, owned address. `403`, `409`. |
| `PATCH /seller/stores/:storeId` | `{displayName?,description?,addressId?}` | `200 {data:store}` | Bearer, store owner | Ownership and mutable fields. `403`, `404`. |
| `GET /seller/products` | filters/pagination | `200 {data:[product],meta}` | Bearer, seller store owner | `403`. |
| `POST /seller/products` | `{storeId,brandId?,name,description,categories,options,variants,images?}` | `201 {data:product}` | Bearer, store owner with `product:create` | Schema validates unique SKU/option combinations, category/brand IDs. `403`, `409 DUPLICATE_RESOURCE`. |
| `PATCH /seller/products/:productId` | Product mutable fields | `200 {data:product}` | Bearer, store owner with `product:update` | Cannot mutate historical order snapshots; valid categories/status transitions. `403`, `409`. |
| `DELETE /seller/products/:productId` | — | `204` | Bearer, store owner with `product:archive` | Archives; cannot hard-delete referenced history. `403`, `409 INVALID_STATE`. |
| `POST /seller/products/:productId/images/presign` | `{filename,contentType,sizeBytes,variantId?}` | `201 {data:{uploadUrl,storageKey,expiresAt}}` | Bearer, store owner | Image MIME/size limits and active product. `403`, `413 PAYLOAD_TOO_LARGE`. |
| `POST /seller/products/:productId/images` | `{storageKey,altText?,position,variantId?}` | `201 {data:image}` | Bearer, store owner | Must match issued S3 key and verified uploaded object. `404`, `422 INVALID_MEDIA`. |
| `GET /seller/warehouses` | — | `200 {data:[warehouse]}` | Bearer, seller owner | `403`. |
| `POST /seller/warehouses` | `{storeId,addressId,code,name}` | `201 {data:warehouse}` | Bearer, store owner | Owned address; unique code/store. `403`, `409`. |
| `PATCH /seller/warehouses/:warehouseId` | `{name?,addressId?,isActive?}` | `200 {data:warehouse}` | Bearer, store owner | Cannot deactivate while pending fulfillment requires it. `409 INVALID_STATE`. |
| `GET /seller/inventory` | `storeId?,variantId?,warehouseId?,cursor?` | `200 {data:[inventory],meta}` | Bearer, store owner | Scope must be owned store. `403`. |
| `POST /seller/inventory/adjustments` | `{warehouseId,productVariantId,quantityDelta,reason}` | `201 {data:inventoryMovement}` | Bearer, store owner with `inventory:adjust` | Non-zero integer; cannot make stock negative; optimistic version checked. `409 CONFLICT`, `422 INSUFFICIENT_INVENTORY`. |
| `GET /seller/orders` | filters/pagination | `200 {data:[sellerOrderLine],meta}` | Bearer, seller owner | Only own store order items. `403`. |
| `POST /seller/shipments` | `{orderId,warehouseId,shippingMethodId,items:[{orderItemId,quantity}],trackingNumber?}` | `201 {data:shipment}` | Bearer, fulfillment owner | Only owned, paid, unshipped quantities; warehouse stock. `403`, `409`, `422`. |
| `PATCH /seller/shipments/:shipmentId/status` | `{status,trackingNumber?,location?,details?}` | `200 {data:shipment}` | Bearer, shipment's store owner | Legal status transition. `403`, `409 INVALID_STATE`. |

## Admin APIs

All endpoints below require Bearer plus the listed permission; `admin:*` is shorthand for an explicit RBAC permission, never only a UI check.

| Method & endpoint | Request | Success response | Authorization | Validation and possible errors |
|---|---|---|---|---|
| `GET /admin/users` | filters/pagination | `200 {data:[user],meta}` | `user:read:any` | Allow-listed PII filters. `403`. |
| `PATCH /admin/users/:userId/status` | `{status,reason}` | `200 {data:user}` | `user:manage` | Valid lifecycle transition; audit logged. `409 INVALID_STATE`. |
| `PUT /admin/users/:userId/roles` | `{roleIds:[uuid]}` | `200 {data:{roles}}` | `role:assign` | Role UUIDs; cannot remove last break-glass admin. `409`. |
| `GET /admin/seller-applications` | filters/pagination | `200 {data:[sellerProfile],meta}` | `seller:review` | `403`. |
| `PATCH /admin/seller-applications/:sellerId` | `{verificationStatus,reason?,commissionRateBps?}` | `200 {data:sellerProfile}` | `seller:review` | Valid transition and basis-point range. `409`. |
| `POST /admin/brands` | `{name,slug,description?}` | `201 {data:brand}` | `catalog:manage` | Unique normalized name/slug. `409`. |
| `PATCH /admin/brands/:brandId` | Brand mutable fields | `200 {data:brand}` | `catalog:manage` | Unique slug/name. `409`. |
| `POST /admin/categories` | `{name,slug,parentCategoryId?}` | `201 {data:category}` | `catalog:manage` | Parent exists; no cycle. `409 CATEGORY_CYCLE`. |
| `PATCH /admin/categories/:categoryId` | Category mutable fields | `200 {data:category}` | `catalog:manage` | No self/descendant parent; unique slug. `409`. |
| `PATCH /admin/products/:productId/status` | `{status,reason?}` | `200 {data:product}` | `product:moderate` | Valid moderation transition. `409 INVALID_STATE`. |
| `GET /admin/orders` | filters/pagination | `200 {data:[order],meta}` | `order:read:any` | Allow-listed filters. |
| `PATCH /admin/orders/:orderId/status` | `{status,reason}` | `200 {data:order}` | `order:manage:any` | State-machine transition; audit logged. `409 INVALID_STATE`. |
| `GET /admin/payments` | filters/pagination | `200 {data:[payment],meta}` | `payment:read:any` | Never returns provider secrets/PCI data. |
| `POST /admin/payments/:paymentId/refunds` | `{amountMinor,reason}` + `Idempotency-Key` | `202 {data:refund}` | `refund:create` | Paid payment, amount ≤ remaining refundable. `409`, `422 REFUND_INELIGIBLE`, `502`. |
| `GET /admin/returns` | filters/pagination | `200 {data:[returnRequest],meta}` | `return:manage` | `403`. |
| `PATCH /admin/returns/:returnId` | `{status,resolution?,note?}` | `200 {data:returnRequest}` | `return:manage` | Valid state transition, received quantities; may create refund job. `409`, `422`. |
| `GET /admin/reviews` | filters/pagination | `200 {data:[review],meta}` | `review:moderate` | `403`. |
| `PATCH /admin/reviews/:reviewId/status` | `{status,reason?}` | `200 {data:review}` | `review:moderate` | Valid moderation status. `409`. |
| `GET /admin/coupons` | filters/pagination | `200 {data:[coupon],meta}` | `coupon:manage` | `403`. |
| `POST /admin/coupons` | coupon definition including eligibility arrays | `201 {data:coupon}` | `coupon:manage` | Unique code, valid date range/discount shape/limits, existing eligible IDs. `409`, `422`. |
| `PATCH /admin/coupons/:couponId` | Coupon mutable fields | `200 {data:coupon}` | `coupon:manage` | Cannot make historic redemption invalid; valid lifecycle. `409`. |
| `GET /admin/invoices` | filters/pagination | `200 {data:[invoice],meta}` | `invoice:read:any` | `403`. |
| `POST /admin/orders/:orderId/invoice` | — | `201 {data:invoice}` | `invoice:issue` | Eligible order, idempotent creation. `409 INVOICE_EXISTS`, `422`. |
| `GET /admin/audit-logs` | `actorId?,entityType?,entityId?,cursor?` | `200 {data:[auditLog],meta}` | `audit:read` | Restrictive filters and cursor only. `403`. |

## Operational endpoints

| Method & endpoint | Request | Success response | Auth / authorization | Validation and possible errors |
|---|---|---|---|---|
| `GET /health/live` | — | `200 {data:{status:"ok"}}` | Private network or public minimal | No dependency checks. |
| `GET /health/ready` | — | `200 {data:{status:"ok"}}` | Private network/load balancer | Checks database and critical dependencies; `503` when not ready. |
| `GET /metrics` | — | Prometheus text | Private network/monitoring role | Never exposed publicly. `401`, `403`. |

## DTO examples

### Product detail response

```json
{
  "data": {
    "id": "b4b09a4e-9db6-4a54-b03a-7444e20f5bc0",
    "name": "Northern Weave Shirt",
    "slug": "northern-weave-shirt",
    "store": { "id": "...", "name": "Arewa Textiles" },
    "brand": { "id": "...", "name": "Arewa" },
    "variants": [{ "id": "...", "sku": "AWS-SHIRT-BLU-M", "attributes": { "Colour": "Blue", "Size": "M" }, "price": { "amountMinor": 125000, "currency": "NGN" }, "available": true }],
    "images": [{ "url": "https://cdn.example.com/products/...", "altText": "Blue shirt" }]
  }
}
```

### Order response

```json
{
  "data": {
    "id": "...",
    "orderNumber": "AXM-20260725-000123",
    "status": "PAID",
    "currency": "NGN",
    "totals": { "subtotalMinor": 125000, "discountMinor": 5000, "shippingMinor": 2000, "taxMinor": 0, "totalMinor": 122000 },
    "items": [{ "id": "...", "name": "Northern Weave Shirt", "sku": "AWS-SHIRT-BLU-M", "quantity": 1, "lineTotalMinor": 120000 }],
    "shipments": [],
    "payment": { "id": "...", "status": "PENDING", "provider": "PAYSTACK" }
  }
}
```
