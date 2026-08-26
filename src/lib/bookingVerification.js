import { API_BASE_URL, getApiOrigin } from '../config/api';

export function formatRwf(value) {
  return `RWF ${Number(value || 0).toLocaleString()}`;
}

export function bookingQrImageUrl(token) {
  if (!token) return '';
  return `${API_BASE_URL}/qr/${encodeURIComponent(token)}`;
}

export function bookingReceiptUrl(token, { print = false } = {}) {
  if (!token) return '';
  return `${API_BASE_URL}/receipt/${encodeURIComponent(token)}${print ? '?print=1' : ''}`;
}

export function extractBookingLookup(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.nativeEvent) return '';
    const fromObject = value.verificationToken || value.bookingCode || value.verifyUrl || value.bookingId;
    if (fromObject) return extractBookingLookup(fromObject);
  }

  const text = String(value || '').trim();
  if (!text || text === '[object Object]') return '';

  try {
    const parsed = JSON.parse(text);
    const fromJson = parsed?.verificationToken || parsed?.bookingCode || parsed?.verifyUrl || parsed?.bookingId;
    if (fromJson) return extractBookingLookup(fromJson);
  } catch (_error) {
    /* not JSON */
  }

  const verifyMatch = text.match(/\/verify\/([^/?#]+)/i);
  if (verifyMatch?.[1]) {
    try {
      return decodeURIComponent(verifyMatch[1]);
    } catch (_error) {
      return verifyMatch[1];
    }
  }

  const origin = getApiOrigin();
  if (origin && text.startsWith(origin)) {
    const pathMatch = text.match(/\/(?:qr|receipt)\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      try {
        return decodeURIComponent(pathMatch[1]);
      } catch (_error) {
        return pathMatch[1];
      }
    }
  }

  return text.replace(/^.*\/verify\//i, '').trim();
}

export function verificationShareText(booking) {
  const code = booking?.bookingCode || booking?.bookingId || '';
  const name = booking?.customerName || booking?.touristId?.name || booking?.bookingDetails?.fullName || 'Guest';
  const service = booking?.serviceName || booking?.businessName || booking?.bookingDetails?.requestedService || '';
  const dates = [booking?.checkIn, booking?.checkOut].filter(Boolean).join(' → ')
    || (booking?.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : '');
  const paid = formatRwf(booking?.amountPaid || booking?.depositAmount || 0);
  return [
    `SafarisCon ${code}`,
    name,
    service,
    dates,
    `Paid ${paid}`,
  ].filter(Boolean).join('\n');
}

export function pinIsSet(pin = {}) {
  const latitude = String(pin.latitude ?? '').trim();
  const longitude = String(pin.longitude ?? '').trim();
  if (!latitude || !longitude) return false;
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}
