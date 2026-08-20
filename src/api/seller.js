import { apiFetch } from '../config/api';

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function apiFetchFirst(paths, options = {}) {
  let lastResponse = null;
  for (const path of paths) {
    const response = await apiFetch(path, options);
    lastResponse = response;
    if (response.ok || ![404, 405].includes(response.status)) return response;
  }
  return lastResponse;
}

function asList(payload, ...keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export async function fetchSellerOverview() {
  const response = await apiFetch('/hotel/overview', { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load seller overview.');
  return data;
}

export async function fetchSellerServices({ page = 1, limit = 50 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
  const response = await apiFetch(`/hotel/services?${query}`, { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load services.');
  return asList(data, 'services', 'items', 'businesses');
}

export async function fetchSellerService(serviceId) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}`, { timeoutMs: 15000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load service.');
  return data.service || data;
}

export async function createSellerService(payload) {
  const response = await apiFetch('/hotel/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not create service.');
  return data;
}

export async function updateSellerService(serviceId, payload) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not update service.');
  return data;
}

export async function deleteSellerService(serviceId) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}`, {
    method: 'DELETE',
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not delete service.');
  return data;
}

export async function uploadSellerImages(formData) {
  const response = await apiFetch('/hotel/uploads/images', {
    method: 'POST',
    body: formData,
    timeoutMs: 60000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not upload images.');
  return data.urls || data.images || [];
}

export async function fetchSellerBookings({ page = 1, limit = 50 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
  const response = await apiFetch(`/hotel/bookings?${query}`, { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load bookings.');
  return asList(data, 'bookings', 'items');
}

export async function updateSellerBookingStatus(bookingId, body) {
  const response = await apiFetch(`/hotel/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not update booking.');
  return data;
}

export async function verifySellerBookingCode(code) {
  const response = await apiFetchFirst(['/seller/bookings/verify-code', '/hotel/bookings/verify-code'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Invalid booking code.');
  return data.booking || data;
}

export async function completeVerifiedSellerBooking({ bookingId, code }) {
  const response = await apiFetchFirst(['/seller/bookings/complete-verified', '/hotel/bookings/complete-verified'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, code }),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not complete booking.');
  return data;
}

export async function lookupSellerBookingVerification(lookup) {
  const response = await apiFetch(`/hotel/booking-verification/${encodeURIComponent(lookup)}`, { timeoutMs: 15000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not verify booking.');
  return data.booking || data;
}

export async function fetchSellerRebookRequests({ page = 1 } = {}) {
  const response = await apiFetch(`/rebook/seller?page=${page}`, { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load rebook requests.');
  return asList(data, 'requests', 'items');
}

export async function confirmRebookUnavailable(requestId) {
  const response = await apiFetch(`/rebook/${encodeURIComponent(requestId)}/confirm-unavailable`, {
    method: 'POST',
    timeoutMs: 12000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not confirm unavailability.');
  return data;
}

export async function fetchSellerPayoutDetails() {
  const response = await apiFetch('/hotel/payout-details', { timeoutMs: 10000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load payout details.');
  return data.payoutDetails || data;
}

export async function saveSellerPayoutDetails(payoutDetails) {
  const response = await apiFetch('/hotel/payout-details', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payoutDetails }),
    timeoutMs: 12000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save payout details.');
  return data.payoutDetails || data;
}

export async function fetchSellerFinance() {
  const response = await apiFetch('/hotel/finance', { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load finance.');
  return {
    summary: data.summary || data.stats || {},
    transactions: asList(data, 'transactions', 'items'),
    raw: data,
  };
}

export async function fetchSellerPaymentProviders() {
  const response = await apiFetch('/payments/methods', { timeoutMs: 8000, skipAuth: true });
  const data = await readJson(response);
  return {
    mobileMoneyProviders: asList(data, 'mobileMoneyProviders').map((item) => ({
      id: item.id || item.code,
      name: item.name || item.label || item.id,
    })),
    bankProviders: asList(data, 'bankProviders').map((item) => ({
      id: item.id || item.code,
      name: item.name || item.label || item.id,
    })),
  };
}

export function buildServicePayload(form) {
  const imageUrls = (form.images || []).map((image) => String(image || '').trim()).filter(Boolean).slice(0, 3);
  const normalizedStatus = form.status === 'unavailable' ? 'unavailable' : 'available';
  const availabilityText = form.status === 'custom' ? form.customAvailability : form.remainingQuantity;
  const quantityMatch = String(form.remainingQuantity || form.customAvailability || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  const cancelWindowHours = Number(form.cancelWindowHours) || 6;
  const cancelPenaltyPercent = Number(form.cancelPenaltyPercent) || 20;
  const location = form.serviceLocation || {};
  const formattedAddress = location.formattedAddress || location.fullAddress || [location.street, location.city, location.country].filter(Boolean).join(', ');

  return {
    title: form.title,
    description: form.description,
    category: form.category,
    serviceType: form.serviceType || 'rental',
    status: normalizedStatus,
    availableQuantity: quantityMatch ? Number(quantityMatch[0]) : normalizedStatus === 'available' ? 1 : 0,
    availabilityText,
    priceText: '',
    pricing: { amount: 0, unit: 'service', currency: 'RWF' },
    isActive: true,
    images: imageUrls,
    serviceLocation: {
      ...location,
      latitude: location.latitude === '' ? '' : Number(location.latitude) || location.latitude,
      longitude: location.longitude === '' ? '' : Number(location.longitude) || location.longitude,
      formattedAddress,
      fullAddress: location.fullAddress || formattedAddress,
      street: location.street || location.fullAddress || '',
    },
    locationDetails: {
      country: location.country,
      state: location.state || location.province,
      city: location.city || location.district,
      street: location.street || location.fullAddress || '',
      province: location.state || location.province,
      district: location.city || location.district,
      sector: location.sector,
      cell: location.cell,
      village: location.village,
    },
    contactDetails: {
      phone: form.contactDetails?.phone || '',
      whatsapp: form.contactDetails?.whatsapp || '',
    },
    cancelWindowHours,
    cancelPenaltyPercent,
    cancellationPolicy: {
      windowHours: cancelWindowHours,
      penaltyPercent: cancelPenaltyPercent,
    },
    promotion: {
      ...form.promotion,
      percent: String(form.promotion?.percent || ''),
      startAt: form.promotion?.startAt || '',
      endAt: form.promotion?.endAt || '',
    },
    rebookSettings: {
      requestDeadlineHours: Number(form.rebookSettings?.requestDeadlineHours) || 24,
      rebookIdValidityHours: Number(form.rebookSettings?.rebookIdValidityHours) || 72,
    },
    availabilityTable: {
      ...form.availabilityTable,
      updatedAt: new Date().toISOString(),
    },
    bookingForm: form.bookingForm,
    bookingMode: form.bookingMode || 'manual',
  };
}
