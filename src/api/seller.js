import { apiFetch } from '../config/api';
import { toE164 } from '../lib/phone';

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

export async function fetchSellerServices({ page = 1, limit = 50, categoryId, categorySlug } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (categoryId) query.set('categoryId', categoryId);
  if (categorySlug) query.set('categorySlug', categorySlug);
  const response = await apiFetch(`/hotel/services?${query.toString()}`, { timeoutMs: 12000 });
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
  if (!response.ok) throw new Error(data.message || data.error || data.code || 'Could not create service.');
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
  if (!response.ok) throw new Error(data.message || data.error || data.code || 'Could not update service.');
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

export async function fetchSellerServiceOptions(serviceId) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}/options`, { timeoutMs: 12000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load options.');
  return asList(data, 'options', 'items');
}

export async function createSellerServiceOption(serviceId, body) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not create option.');
  return data.option || data;
}

export async function updateSellerServiceOption(serviceId, optionId, body) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}/options/${encodeURIComponent(optionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not update option.');
  return data.option || data;
}

export async function deleteSellerServiceOption(serviceId, optionId) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}/options/${encodeURIComponent(optionId)}`, {
    method: 'DELETE',
    timeoutMs: 12000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not delete option.');
  return data;
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

function buildLocationPayload(location = {}) {
  const latRaw = location.latitudeRaw != null && location.latitudeRaw !== ''
    ? String(location.latitudeRaw)
    : location.latitude !== '' && location.latitude != null
      ? String(location.latitude)
      : '';
  const lngRaw = location.longitudeRaw != null && location.longitudeRaw !== ''
    ? String(location.longitudeRaw)
    : location.longitude !== '' && location.longitude != null
      ? String(location.longitude)
      : '';
  const latitude = latRaw === '' ? undefined : Number(latRaw);
  const longitude = lngRaw === '' ? undefined : Number(lngRaw);
  const formattedAddress = location.formattedAddress || location.fullAddress
    || [location.street, location.area, location.city, location.state, location.country].filter(Boolean).join(', ');

  return {
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    latitudeRaw: latRaw || undefined,
    longitudeRaw: lngRaw || undefined,
    formattedAddress,
    fullAddress: location.fullAddress || formattedAddress,
    country: location.country || '',
    countryCode: location.countryCode || '',
    state: location.state || location.province || '',
    city: location.city || location.district || '',
    area: location.area || location.sector || '',
    placeName: location.placeName || '',
    placeId: location.placeId || '',
    street: location.street || '',
    locationSource: location.locationSource || 'map_click',
  };
}

function buildContactPayload(contact = {}) {
  const phone = contact.phoneE164
    ? { phoneE164: contact.phoneE164, phoneIso: contact.phoneIso || 'RW' }
    : toE164(contact.phone || contact.display || '', contact.phoneIso || 'RW');
  const whatsappSource = contact.whatsappE164 || contact.whatsapp || '';
  const whatsapp = whatsappSource
    ? (contact.whatsappE164
      ? { phoneE164: contact.whatsappE164, phoneIso: contact.whatsappIso || 'RW' }
      : toE164(whatsappSource, contact.whatsappIso || 'RW'))
    : { phoneE164: '', phoneIso: 'RW' };

  return {
    phoneE164: phone.phoneE164,
    phoneIso: phone.phoneIso || 'RW',
    ...(whatsapp.phoneE164
      ? { whatsappE164: whatsapp.phoneE164, whatsappIso: whatsapp.phoneIso || 'RW' }
      : {}),
    // Legacy dual-write for older backends during migration
    phone: phone.phoneE164 || contact.phone || '',
    whatsapp: whatsapp.phoneE164 || contact.whatsapp || '',
  };
}

/** Schema-driven seller create/update body. Omits forbidden seller fields. */
export function buildServicePayload(form, { category } = {}) {
  const imageUrls = (form.images || []).map((image) => String(image || '').trim()).filter(Boolean).slice(0, 5);
  const normalizedStatus = form.status === 'unavailable' ? 'unavailable' : 'available';
  const supportsOptions = category?.supportsOptions !== false && form.supportsOptions !== false;
  const location = buildLocationPayload(form.location || form.serviceLocation || {});
  const contactDetails = buildContactPayload(form.contactDetails || {});

  const payload = {
    categoryId: form.categoryId || category?._id || category?.id,
    title: form.title,
    description: form.description,
    status: normalizedStatus,
    primaryImage: form.primaryImage || imageUrls[0] || '',
    images: imageUrls,
    location,
    // Keep legacy keys for transition
    serviceLocation: location,
    locationDetails: {
      country: location.country,
      state: location.state,
      city: location.city,
      street: location.street,
      area: location.area,
    },
    contactDetails,
    listingAttributes: form.listingAttributes || {},
    rebookSettings: {
      requestDeadlineHours: Number(form.rebookSettings?.requestDeadlineHours) || 24,
      rebookIdValidityHours: Number(form.rebookSettings?.rebookIdValidityHours) || 72,
    },
  };

  if (!supportsOptions) {
    const basePrice = Number(form.basePrice);
    if (Number.isFinite(basePrice) && basePrice >= 0) {
      payload.basePrice = basePrice;
    }
  }

  return payload;
}

export function buildOptionPayload(option = {}) {
  return {
    name: option.name || option.service || '',
    price: Number(option.price) || 0,
    currency: option.currency || 'RWF',
    priceType: option.priceType || 'fixed',
    calculationField: option.calculationField || 'duration',
    durationUnit: option.durationUnit || 'days',
    capacity: Number(option.capacity ?? option.availability) || 1,
    maximumDuration: option.maximumDuration ? Number(option.maximumDuration) : undefined,
    attributes: option.attributes || {},
    isActive: option.isActive !== false,
  };
}
