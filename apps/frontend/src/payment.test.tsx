import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PayNow, PaymentReturn } from './Payment';
import { api } from './api';

vi.mock('./auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('./api', async () => { const actual = await vi.importActual<typeof import('./api')>('./api'); return { ...actual, api: { ...actual.api, createPayment: vi.fn(), payment: vi.fn() } }; });

const order = { id: 'o1', orderNumber: 'AX-1', status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', currency: 'NGN', totals: { subtotalMinor: 1000, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 1000 }, items: [], placedAt: new Date().toISOString() };
const payment = { id: 'p1', orderId: 'o1', orderNumber: 'AX-1', provider: 'PAYSTACK', providerReference: 'AXM-PAY-1', status: 'PENDING', amountMinor: 1000, currency: 'NGN', authorizedAt: null, capturedAt: null, createdAt: new Date().toISOString(), authorizationUrl: 'https://checkout.paystack.com/test' };

describe('customer Pay Now flow', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); Object.defineProperty(window, 'location', { value: { assign: vi.fn() }, configurable: true }); });
  it('initializes with an idempotency key and redirects to the hosted URL', async () => {
    vi.mocked(api.createPayment).mockResolvedValue(payment);
    render(<MemoryRouter><PayNow order={order} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));
    await waitFor(() => expect(api.createPayment).toHaveBeenCalledWith('o1', expect.any(String)));
    expect(window.location.assign).toHaveBeenCalledWith(payment.authorizationUrl);
    expect(JSON.parse(sessionStorage.getItem('arewaexpressmart.payment.return')!).paymentId).toBe('p1');
  });
  it('prevents duplicate clicks and preserves the attempt on initialization failure', async () => {
    vi.mocked(api.createPayment).mockRejectedValue(new Error('Provider unavailable'));
    render(<MemoryRouter><PayNow order={order} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /pay now/i }); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable'));
    expect(api.createPayment).toHaveBeenCalledTimes(1);
  });
  it('does not show Pay Now for a paid order', () => {
    render(<MemoryRouter><PayNow order={{ ...order, paymentStatus: 'PAID' }} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument();
  });
  it('renders authoritative return statuses and ignores forged query parameters', async () => {
    sessionStorage.setItem('arewaexpressmart.payment.return', JSON.stringify({ orderId: 'o1', paymentId: 'p1' }));
    vi.mocked(api.payment).mockResolvedValue({ ...payment, status: 'PENDING' });
    render(<MemoryRouter initialEntries={['/payment/return?status=success&reference=fake-reference']}><PaymentReturn /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /still processing/i })).toBeInTheDocument();
    expect(screen.queryByText(/payment confirmed/i)).not.toBeInTheDocument();
    vi.mocked(api.payment).mockResolvedValue({ ...payment, status: 'PAID' });
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
    expect(await screen.findByRole('heading', { name: /payment confirmed/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('arewaexpressmart.payment.return')).toBeNull();
  });
  it('renders unknown statuses as safe processing without claiming success', async () => {
    sessionStorage.setItem('arewaexpressmart.payment.return', JSON.stringify({ orderId: 'o1', paymentId: 'p1' }));
    vi.mocked(api.payment).mockResolvedValue({ ...payment, status: 'PROCESSING_UNKNOWN' });
    render(<MemoryRouter initialEntries={['/payment/return?status=success']}><PaymentReturn /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /still processing/i })).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
  });
  it.each(['FAILED', 'CANCELLED'])('renders %s from the backend only', async (status) => {
    sessionStorage.setItem('arewaexpressmart.payment.return', JSON.stringify({ orderId: 'o1', paymentId: 'p1' }));
    vi.mocked(api.payment).mockResolvedValue({ ...payment, status });
    render(<MemoryRouter initialEntries={['/payment/return?status=paid']}><PaymentReturn /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: new RegExp(status === 'FAILED' ? 'payment failed' : 'payment cancelled', 'i') })).toBeInTheDocument();
  });
  it('handles missing or malformed return context safely', async () => {
    sessionStorage.setItem('arewaexpressmart.payment.return', '{bad-json');
    render(<MemoryRouter initialEntries={['/payment/return?status=success']}><PaymentReturn /></MemoryRouter>);
    expect(await screen.findByText(/could not identify the payment/i)).toBeInTheDocument();
    sessionStorage.setItem('arewaexpressmart.payment.return', JSON.stringify({ orderId: 'o1' }));
  });
  it('shows a safe error when status lookup fails', async () => {
    sessionStorage.setItem('arewaexpressmart.payment.return', JSON.stringify({ orderId: 'o1', paymentId: 'p1' }));
    vi.mocked(api.payment).mockRejectedValue(Object.assign(new Error('Session expired'), { status: 401 }));
    render(<MemoryRouter initialEntries={['/payment/return']}><PaymentReturn /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /status unavailable/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
  });
  it('rejects unsafe authorization URLs', async () => {
    vi.mocked(api.createPayment).mockResolvedValue({ ...payment, authorizationUrl: 'javascript:alert(1)' });
    render(<MemoryRouter><PayNow order={order} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/checkout is unavailable/i);
  });
});
