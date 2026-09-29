export type ApiError = Error & { status?: number; code?: string; details?: unknown };
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1';
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;
function errorFrom(status: number, body: unknown): ApiError { const item = body as { detail?: string; code?: string; errors?: unknown[] } | null; const error = new Error(item?.detail ?? `Request failed (${status})`) as ApiError; error.status = status; error.code = item?.code; error.details = item?.errors; return error; }
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers); headers.set('Accept', 'application/json'); if (init.body) headers.set('Content-Type', 'application/json'); if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (response.status === 401 && retry && path !== '/auth/token' && path !== '/auth/login') { try { const refreshed = await request<{ accessToken: string }>('/auth/token', { method: 'POST' }, false); accessToken = refreshed.accessToken; return request<T>(path, init, false); } catch { accessToken = null; } }
  if (!response.ok) throw errorFrom(response.status, body);
  return (body as { data: T } | undefined)?.data as T;
}
export const api = {
  register: (input: unknown) => request<{ userId: string; email: string; status: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: unknown) => request<{ accessToken: string; expiresIn: number; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  verifyEmail: (token: string) => request<User>('/auth/email-verifications/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email: string) => request<{ accepted: boolean }>('/auth/email-verifications', { method: 'POST', body: JSON.stringify({ email }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  updateProfile: (input: { firstName?: string; lastName?: string; phoneE164?: string | null }) => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
  products: (query = '') => request<Product[]>(`/products${query ? `?${query}` : ''}`),
  product: (idOrSlug: string) => request<Product>(`/products/${encodeURIComponent(idOrSlug)}`),
  categories: () => request<Category[]>('/categories'),
  brands: () => request<Brand[]>('/brands'),
  cart: () => request<Cart>('/cart'),
  addCartItem: (productVariantId: string, quantity: number) => request<Cart>('/cart/items', { method: 'POST', body: JSON.stringify({ productVariantId, quantity }) }),
  updateCartItem: (id: string, quantity: number) => request<Cart>(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  removeCartItem: (id: string) => request<void>(`/cart/items/${id}`, { method: 'DELETE' }),
  addresses: () => request<Address[]>('/me/addresses'),
  createAddress: (input: AddressInput) => request<Address>('/me/addresses', { method: 'POST', body: JSON.stringify(input) }),
  updateAddress: (id: string, input: Partial<AddressInput>) => request<Address>(`/me/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  quote: (input: CheckoutInput) => request<Quote>('/checkout/quote', { method: 'POST', body: JSON.stringify(input) }),
  placeOrder: (input: CheckoutInput, idempotencyKey: string) => request<Order>(`/checkout`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  createPayment: (orderId: string, idempotencyKey: string) => request<PaymentInitialization>(`/orders/${encodeURIComponent(orderId)}/payments`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ provider: 'PAYSTACK' }) }),
  payment: (paymentId: string) => request<Payment>(`/payments/${encodeURIComponent(paymentId)}`),
  countries: () => request<Country[]>('/locations/countries'),
  states: (countryId?: string) => request<StateProvince[]>(`/locations/states${countryId ? `?countryId=${encodeURIComponent(countryId)}` : ''}`),
  cities: (stateProvinceId?: string) => request<City[]>(`/locations/cities${stateProvinceId ? `?stateProvinceId=${encodeURIComponent(stateProvinceId)}` : ''}`),
  orders: () => request<Order[]>('/orders'),
  order: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}`),
  shipments: (orderId: string) => request<Shipment[]>(`/orders/${encodeURIComponent(orderId)}/shipments`),
  invoice: (orderId: string) => request<Invoice>(`/orders/${encodeURIComponent(orderId)}/invoice`),
  returns: () => request<ReturnRequest[]>('/returns'),
  returnDetail: (id: string) => request<ReturnRequest>(`/returns/${encodeURIComponent(id)}`),
  createReturn: (orderId: string, input: ReturnInput) => request<ReturnRequest>(`/orders/${encodeURIComponent(orderId)}/returns`, { method: 'POST', body: JSON.stringify(input) }),
  notifications: () => request<Notification[]>('/me/notifications'),
  markNotificationRead: (id: string) => request<Notification>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
};
export type User = { id: string; email: string; firstName: string; lastName: string; emailVerifiedAt: string | null; status: string; roles: string[]; permissions: string[] };
export type Category = { id: string; name: string; slug: string; parentCategoryId: string | null };
export type Brand = { id: string; name: string; slug: string; description?: string | null };
export type Product = { id: string; name: string; slug: string; description: string; status: string; store: { id: string; slug: string; displayName: string }; brand: Brand | null; categories: Category[]; variants: { id: string; sku: string; isActive: boolean; price: { amountMinor: number; currency: string } | null }[]; images: { id: string; storageKey: string; altText?: string | null; position: number }[] };
export type Cart = { id: string; currency: string; items: { id: string; quantity: number; unitPrice: { amountMinor: number; currency: string }; productVariant: { id: string; sku: string; isActive: boolean; product: { id: string; name: string; slug: string; store: { displayName: string } }; currentPrice: { amountMinor: number; currency: string } | null } }[] };
export type Address = { id: string; recipientName: string; phoneE164: string; line1: string; line2: string | null; postalCode: string | null; isDefaultShipping: boolean; isDefaultBilling: boolean; city: { id: string; name: string; state: { id: string; name: string; country: { code: string; name: string } } } };
export type AddressInput = { recipientName: string; phoneE164: string; line1: string; line2?: string | null; cityId: string; postalCode?: string | null; isDefaultShipping?: boolean; isDefaultBilling?: boolean };
export type Country = { id: string; iso2: string; name: string }; export type StateProvince = { id: string; countryId: string; code: string; name: string }; export type City = { id: string; stateProvinceId: string; name: string };
export type CheckoutInput = { shippingAddressId: string; billingAddressId?: string }; export type Quote = { currency: string; lines: { productVariantId: string; productName: string; sku: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; currency: string }[]; subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number; shippingAddress: Address; billingAddress: Address };
export type Order = { id: string; orderNumber: string; status: string; paymentStatus?: string; currency: string; totals: { subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number }; items: { id: string; productName: string; sku: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; currency: string }[]; placedAt: string };
export type Payment = { id: string; orderId: string; orderNumber: string; provider: string; providerReference: string; status: string; amountMinor: number; currency: string; authorizedAt: string | null; capturedAt: string | null; createdAt: string };
export type PaymentInitialization = Payment & { authorizationUrl?: string };
export type Shipment = { id: string; orderId: string; status: string; carrier: string; shippingMethod: string; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null; createdAt: string };
export type Invoice = { id: string; orderId: string; orderNumber: string; invoiceNumber: string; status: string; currency: string; totals: { subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number }; items: { id: string; description: string; sku: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; currency: string }[]; issuedAt: string; dueAt: string | null };
export type ReturnRequest = { id: string; orderId: string; status: string; reason: string; note: string | null; items: { orderItemId: string; quantity: number }[]; refunds: { id: string; status: string; amountMinor: number; currency: string }[]; requestedAt: string; approvedAt: string | null; receivedAt: string | null };
export type ReturnInput = { reasonCode: string; items: { orderItemId: string; quantity: number }[]; note?: string };
export type Notification = { id: string; channel: string; status: string; template: string; payload: Record<string, unknown>; attempts: number; readAt: string | null; sentAt: string | null; createdAt: string };
export { API_BASE_URL };
