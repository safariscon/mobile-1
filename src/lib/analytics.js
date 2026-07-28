import { apiFetch } from '../config/api';

export const ANALYTICS_EVENTS = {
  APP_VISIT: 'APP_VISIT',
  SERVICE_VIEW: 'SERVICE_VIEW',
  BOOKING_FORM_OPENED: 'BOOKING_FORM_OPENED',
  BOOKING_SUBMITTED: 'BOOKING_SUBMITTED',
  PAY_DEPOSIT_CLICKED: 'PAY_DEPOSIT_CLICKED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
};

const sessionId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function trackAnalytics(eventType, data = {}) {
  apiFetch('/analytics/track', {
    method: 'POST',
    timeoutMs: 4000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType,
      sessionId,
      pageUrl: data.pageUrl || 'safariscon://app',
      serviceId: data.serviceId || undefined,
      bookingId: data.bookingId || undefined,
      paymentId: data.paymentId || undefined,
    }),
  }).catch(() => {});
}
