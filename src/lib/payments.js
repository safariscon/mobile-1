import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch } from '../config/api';
import { createAppPath } from './deepLinks';
import { getAmountDue, isPaidBooking } from './session';

const POLL_MS = 5000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export function normalizePaymentMethod(value) {
  const text = String(value || '').toLowerCase();
  if (['cc', 'card', 'credit', 'credit-card', 'visa', 'mastercard'].includes(text)) {
    return { pmethod: 'cc', paymentMethod: 'card', method: 'cc' };
  }
  return { pmethod: 'momo', paymentMethod: 'momo', method: 'momo' };
}

export function getPaymentCheckoutUrl(data = {}) {
  return data.checkoutUrl
    || data.redirectUrl
    || data.paymentUrl
    || data.url
    || data.gatewayUrl
    || data.checkout_url
    || data.payment?.checkoutUrl
    || '';
}

export async function fetchPaymentMethods() {
  const response = await apiFetch('/payments/methods', { timeoutMs: 8000 });
  const data = await readJson(response);
  const items = data.methods || data.items || data.data || [];
  const methods = (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === 'string') {
        const normalized = normalizePaymentMethod(item);
        return { id: normalized.pmethod, label: normalized.paymentMethod === 'card' ? 'Card' : 'Mobile Money', ...normalized };
      }
      const normalized = normalizePaymentMethod(item.id || item.code || item.pmethod || item.method);
      return {
        id: normalized.pmethod,
        label: item.label || item.name || (normalized.paymentMethod === 'card' ? 'Card' : 'Mobile Money'),
        ...normalized,
      };
    });
  if (methods.length) return methods;
  return [
    { id: 'momo', label: 'Mobile Money', ...normalizePaymentMethod('momo') },
    { id: 'cc', label: 'Card', ...normalizePaymentMethod('cc') },
  ];
}

export async function startBookingPayment(booking, values = {}) {
  const bookingId = booking?._id || booking?.id;
  const method = normalizePaymentMethod(values.pmethod || values.paymentMethod || values.method);
  const redirecturl = values.redirecturl || createAppPath(`/dashboard/bookings?bookingId=${encodeURIComponent(bookingId)}`);
  const payload = {
    ...method,
    email: values.email,
    cname: values.cname || values.name,
    name: values.name || values.cname,
    cnumber: values.cnumber || values.phone || values.senderAccount,
    phone: values.phone || values.senderAccount || values.cnumber,
    senderAccount: values.senderAccount || values.phone || values.cnumber,
    redirecturl,
    returl: values.returl || redirecturl,
    gatewayRedirectUrl: values.gatewayRedirectUrl || redirecturl,
    customerFinalUrl: values.customerFinalUrl || redirecturl,
  };

  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/pay`, {
    method: 'POST',
    timeoutMs: 20000,
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  data.status = response.status;
  data.ok = response.ok;
  return data;
}

export async function fetchPaymentStatus(bookingId) {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/payment-status`, { timeoutMs: 8000 });
  const data = await readJson(response);
  data.status = response.status;
  data.ok = response.ok;
  return data;
}

export function paymentOutcome(data = {}, booking) {
  const code = String(data.code || '').toUpperCase();
  const paidBooking = data.booking || booking;
  if (code === 'PAYMENT_SUCCESS' || code === 'PAYMENT_ALREADY_RECORDED' || isPaidBooking(paidBooking) || data.paid === true) {
    return 'success';
  }
  if (code === 'PAYMENT_FAILED' || data.ok === false) return 'failed';
  if (code === 'PAYMENT_PENDING' || data.pending === true) return 'pending';
  return data.ok ? 'pending' : 'failed';
}

export async function openCheckoutUrl(url) {
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (_error) {
    await Linking.openURL(url);
  }
}

export async function pollPaymentStatus(bookingId, { onUpdate, signal } = {}) {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    if (signal?.aborted) return { outcome: 'cancelled' };
    const data = await fetchPaymentStatus(bookingId);
    const outcome = paymentOutcome(data, data.booking);
    onUpdate?.(data, outcome);
    if (outcome === 'success' || outcome === 'failed') return { outcome, data };
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return { outcome: 'timeout' };
}

export { getAmountDue };
