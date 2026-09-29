import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, type Order, type Payment } from './api';
import { useAuth } from './auth';

const RETURN_CONTEXT = 'arewaexpressmart.payment.return';
function newKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function rememberPaymentReturn(orderId: string, paymentId: string) { sessionStorage.setItem(RETURN_CONTEXT, JSON.stringify({ orderId, paymentId })); }
function validAuthorizationUrl(value: unknown): value is string { if (typeof value !== 'string') return false; try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; } }
function readReturnContext(): { orderId?: string; paymentId?: string } { try { const raw = sessionStorage.getItem(RETURN_CONTEXT); if (!raw) return {}; const value: unknown = JSON.parse(raw); if (!value || typeof value !== 'object') return {}; const context = value as Record<string, unknown>; return { orderId: typeof context.orderId === 'string' && context.orderId ? context.orderId : undefined, paymentId: typeof context.paymentId === 'string' && context.paymentId ? context.paymentId : undefined }; } catch { return {}; } }

export function PayNow({ order, onStatus }: { order: Order; onStatus?: (payment: Payment) => void }) {
  const [working, setWorking] = useState(false); const [error, setError] = useState<string | null>(null); const [key, setKey] = useState<string | null>(null);
  const payable = order.status === 'PENDING_PAYMENT' && order.paymentStatus !== 'PAID';
  if (!payable) return null;
  const start = () => { if (working) return; setWorking(true); setError(null); const attempt = key ?? newKey(); setKey(attempt); void api.createPayment(order.id, attempt).then((payment) => { onStatus?.(payment); if (!validAuthorizationUrl(payment.authorizationUrl)) throw new Error('Payment checkout is unavailable.'); rememberPaymentReturn(order.id, payment.id); window.location.assign(payment.authorizationUrl); }).catch((e: Error) => { setError(e.message); setWorking(false); }); };
  return <div className="payment-action"><button className="button" type="button" onClick={start} disabled={working}>{working ? 'Opening secure checkout…' : 'Pay now'}</button>{working && <p role="status">Connecting to secure Paystack checkout…</p>}{error && <p role="alert" className="error-text">{error}</p>}</div>;
}

function statusLabel(status: string) { return status === 'PAID' ? 'Payment confirmed' : status === 'FAILED' ? 'Payment failed' : status === 'CANCELLED' ? 'Payment cancelled' : 'Payment is still processing'; }
export function PaymentReturn() {
  const { user, loading: authLoading } = useAuth(); const [payment, setPayment] = useState<Payment | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [context] = useState(readReturnContext);
  const load = () => { if (!context.paymentId) { setError('We could not identify the payment to check. Open your orders and try again.'); setLoading(false); return; } setRefreshing(true); void api.payment(context.paymentId).then((value) => { setPayment(value); if (value.status === 'PAID') { try { sessionStorage.removeItem(RETURN_CONTEXT); } catch { /* storage is optional */ } } }).catch((e: Error) => setError(e.message)).finally(() => { setLoading(false); setRefreshing(false); }); };
  useEffect(() => { if (!authLoading && user) load(); else if (!authLoading) setLoading(false); }, [authLoading, user]);
  if (authLoading || loading) return <section className="narrow page"><p role="status">Checking payment status…</p></section>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <section className="narrow page"><h1>Payment status unavailable</h1><p role="alert" className="error-text">{error}</p><Link className="button" to={context.orderId ? `/orders/${context.orderId}` : '/orders'}>Return to orders</Link></section>;
  return <section className="narrow page"><p className="eyebrow">PAYMENT</p><h1>{payment ? statusLabel(payment.status) : 'Payment status unavailable'}</h1>{payment && <><p role="status">Paystack reference: {payment.providerReference}</p>{payment.status === 'PENDING' && <p>Confirmation may take a moment. Refresh to check again.</p>}{payment.status === 'PAID' && <p>Your payment for order <strong>{payment.orderNumber}</strong> is confirmed.</p>}{(payment.status === 'FAILED' || payment.status === 'CANCELLED') && <p>You can return to the order and retry if it remains eligible.</p>}<button className="button" type="button" onClick={load} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh status'}</button><Link className="button" to={`/orders/${payment.orderId}`}>View order</Link></>}</section>;
}
