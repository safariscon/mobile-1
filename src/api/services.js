import { apiFetch, endpoints } from '../config/api';
import i18n from '../i18n';
import { isDraftListing } from '../lib/listings';
import {
  collectImages,
  findServiceInHotelsPayload,
  inventoryStatusLabel,
  normalizeServiceDetail,
  numberFrom,
} from '../lib/serviceMapper';

const SERVICES_CACHE_TTL_MS = 60 * 1000;
const servicesCache = new Map();
const servicesRequests = new Map();
const legacyServiceDetailsCache = new Map();

function servicesCacheKey(page, limit) {
  return `${page}:${limit}`;
}

export function getCachedServices({ page = 1, limit = 20 } = {}) {
  const cached = servicesCache.get(servicesCacheKey(page, limit));
  if (!cached || Date.now() - cached.loadedAt >= SERVICES_CACHE_TTL_MS) return null;
  return cached.data;
}

function pickArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.hotels)) {
    return payload.hotels;
  }

  if (Array.isArray(payload?.services)) {
    return payload.services;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.businesses)) {
    return payload.businesses;
  }

  return [];
}

export function normalizePaginatedPayload(payload, legacyKey = 'items') {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.[legacyKey])
      ? payload[legacyKey]
      : pickArray(payload);
  return {
    items,
    pagination: payload?.pagination || {
      page: 1,
      limit: items.length || 20,
      totalItems: items.length,
      totalPages: items.length ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function labelFromSlug(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function imageFrom(item) {
  const candidate = firstValue(
    item.primaryImage,
    item.image,
    item.imageUrl,
    item.coverImage,
    item.mainImage,
    item.photo,
    item.images?.[0],
    item.photos?.[0],
    item.gallery?.[0]
  );

  if (typeof candidate === 'string') {
    return candidate;
  }

  return firstValue(candidate?.url, candidate?.secure_url, candidate?.path);
}

function optimizeImageUrl(image) {
  const url = typeof image === 'string' ? image.trim() : '';
  if (!url) return '';

  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_640,c_limit/');
  }

  if (url.includes('images.unsplash.com')) {
    const [base, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    params.set('auto', 'format');
    params.set('fit', 'crop');
    params.set('w', '640');
    params.set('q', '70');
    return `${base}?${params.toString()}`;
  }

  return url;
}

export function normalizeService(item, index = 0) {
  const title = firstValue(item.title, item.displayName, item.anonymousName, item.name, item.hotelName, item.businessName, item.serviceName, `${i18n.t('serviceDetails.service')} ${index + 1}`);
  const categoryId = String(firstValue(
    typeof item.categoryId === 'object' ? (item.categoryId?._id || item.categoryId?.id) : item.categoryId,
    item.category?._id,
    item.category?.id,
    ''
  ) || '');
  const categorySlug = firstValue(
    item.categorySlug,
    typeof item.category === 'object' ? item.category?.slug : null,
    typeof item.category === 'string' ? item.category : null,
    item.type,
    item.serviceType,
    item.businessType,
    'service'
  );
  const category = firstValue(
    item.categoryName,
    typeof item.category === 'object' ? item.category?.name : null,
    labelFromSlug(categorySlug)
  );
  const city = firstValue(
    item.generalLocation,
    item.destinationLocation,
    item.city,
    item.district,
    item.province,
    item.serviceLocation?.district,
    item.location?.district,
    item.location?.sector,
    item.location?.province
  );
  const location = firstValue(item.locationName, city, i18n.t('common.rwanda'));
  const priceValue = firstValue(item.priceText, item.price, item.startingPrice, item.basePrice, item.minPrice, item.pricePerNight);
  const price = typeof priceValue === 'number' && priceValue > 0 ? `RWF ${priceValue.toLocaleString()}` : firstValue(typeof priceValue === 'string' ? priceValue : '', i18n.t('serviceDetails.contactForPrice'));
  const availableInventory = numberFrom(item.availableInventory, item.availableQuantity, item.quantityRemaining, item.inventory, item.availabilityTable?.rows?.length, 1);

  return {
    id: String(firstValue(item._id, item.id, item.slug, index)),
    hotelId: String(firstValue(item.hotelId, item._id, item.id, item.slug, index)),
    sourceType: item.sourceType || (item.hotelId ? 'service' : 'hotel'),
    title,
    category,
    categoryName: category,
    categorySlug,
    categoryId: categoryId || null,
    serviceCategory: categorySlug,
    businessType: item.businessType,
    district: firstValue(item.district, item.serviceLocation?.district, item.location?.district),
    address: firstValue(item.address, item.fullAddress, item.serviceLocation?.fullAddress, item.contactDetails?.exactAddress),
    destinationLocation: firstValue(item.destinationLocation, item.serviceLocation?.district, item.location?.district, city),
    location,
    generalLocation: firstValue(item.generalLocation, city, location),
    description: firstValue(item.description, item.shortDescription, item.summary, i18n.t('serviceDetails.privacyDescription')),
    price,
    priceAmount: numberFrom(priceValue, item.startingPrice, item.basePrice, item.minPrice),
    rating: numberFrom(item.rating, item.averageRating, item.reviewScore, 4.8),
    isFeatured: Boolean(item.isFeatured || item.featured),
    availableInventory,
    deposit: firstValue(item.depositLabel, item.deposit, i18n.t('customerBookings.deposit')),
    bookingMode: item.automaticBooking || item.bookingMode === 'automatic' ? i18n.t('serviceDetails.automaticBooking') : firstValue(item.bookingModeLabel, item.bookingMode, i18n.t('serviceDetails.manualQuote')),
    availability: firstValue(item.availabilityLabel, item.availability, item.status, i18n.t('serviceDetails.available')),
    image: optimizeImageUrl(imageFrom(item)) || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=640&q=70',
    promotion: item.promotion || item.primaryService?.promotion || null,
  };
}

function normalizeLegacyServiceDetails(item, index = 0) {
  const summary = normalizeService(item, index);
  const details = normalizeServiceDetail(item, index);
  const imageUrls = collectImages(item).map((image) => image.url);
  return {
    ...summary,
    ...details,
    name: details.title,
    images: imageUrls.length ? imageUrls : [summary.image].filter(Boolean),
    imageItems: collectImages(item),
    availabilityStatus: inventoryStatusLabel(firstValue(item.inventoryStatus, item.status)),
  };
}

async function fetchLegacyCatalog({ page, limit, signal }) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
      const response = await apiFetch(`${endpoints.hotels}?${query}`, { signal, timeoutMs: 8000, skipAuth: true });
  if (!response.ok) throw new Error(i18n.t('backend.returned', { status: response.status }));
  const payload = await response.json();
  const paginated = normalizePaginatedPayload(payload, 'hotels');
  const services = paginated.items.filter((item) => !isDraftListing(item)).map((item, index) => {
    const details = normalizeLegacyServiceDetails(item, index);
    legacyServiceDetailsCache.set(details.id, details);
    return normalizeService({ ...item, hotelId: details.hotelId, sourceType: 'hotel' }, index);
  });
  return { services, pagination: paginated.pagination };
}

export async function fetchServices({ page = 1, limit = 20, signal, force = false } = {}) {
  const cacheKey = servicesCacheKey(page, limit);
  const cached = getCachedServices({ page, limit });
  if (!force && cached) return cached;
  if (!force && servicesRequests.has(cacheKey)) return servicesRequests.get(cacheKey);

  const request = (async () => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
    // A shared catalog request should finish even if the screen that started it
    // unmounts, so another screen can reuse the same result.
    const requestSignal = force ? signal : undefined;
    let data;
    try {
      const response = await apiFetch(`${endpoints.services}?${query}`, { signal: requestSignal, timeoutMs: 8000, skipAuth: true });
      if (!response.ok) throw new Error(i18n.t('backend.returned', { status: response.status }));
      const payload = await response.json();
      const paginated = normalizePaginatedPayload(payload, 'services');
      if (page === 1 && paginated.items.length === 0) {
        data = await fetchLegacyCatalog({ page, limit, signal: requestSignal });
      } else {
        data = {
          services: paginated.items.filter((item) => !isDraftListing(item)).map((item, index) => {
            if (item?.sourceType === 'hotel' || Array.isArray(item?.availabilityTable?.rows)) {
              const details = normalizeLegacyServiceDetails(item, index);
              legacyServiceDetailsCache.set(details.id, details);
            }
            return normalizeService(item, index);
          }),
          pagination: paginated.pagination,
        };
      }
    } catch (error) {
      data = await fetchLegacyCatalog({ page, limit, signal: requestSignal }).catch(() => { throw error; });
    }
    servicesCache.set(cacheKey, { data, loadedAt: Date.now() });
    return data;
  })();

  servicesRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (servicesRequests.get(cacheKey) === request) servicesRequests.delete(cacheKey);
  }
}


async function fetchPublicServiceFromHotels(serviceId, signal) {
  const query = new URLSearchParams({ page: '1', limit: '120' }).toString();
  const response = await apiFetch(`${endpoints.hotels}?${query}`, { signal, timeoutMs: 15000, skipAuth: true });
  if (!response.ok) throw new Error(i18n.t('backend.returned', { status: response.status }));
  const payload = await response.json();
  const item = findServiceInHotelsPayload(payload, serviceId);
  if (!item) return null;
  const details = normalizeServiceDetail(item);
  legacyServiceDetailsCache.set(String(serviceId), { ...normalizeService(item), ...details });
  return details;
}

export async function fetchSellerServiceDetails(serviceId, token) {
  const response = await apiFetch(`/hotel/services/${encodeURIComponent(serviceId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeoutMs: 15000,
  });
  if (!response.ok) throw new Error(i18n.t('backend.returned', { status: response.status }));
  const payload = await response.json();
  const item = payload?.service || payload;
  return normalizeServiceDetail(item);
}

export async function fetchAdminServiceDetails(serviceId, token) {
  const response = await apiFetch(`/admin/services/${encodeURIComponent(serviceId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeoutMs: 15000,
  });
  if (!response.ok) throw new Error(i18n.t('backend.returned', { status: response.status }));
  const payload = await response.json();
  const item = payload?.service || payload;
  return normalizeServiceDetail(item);
}

export async function fetchServiceDetails(serviceId, signal) {
  const cacheKey = String(serviceId);
  const cachedLegacyDetails = legacyServiceDetailsCache.get(cacheKey);
  if (cachedLegacyDetails) return cachedLegacyDetails;

  const response = await apiFetch(endpoints.serviceDetails(serviceId), { signal, timeoutMs: 15000, skipAuth: true });
  if (response.ok) {
    const payload = await response.json();
    const item = payload?.service || payload;
    const details = normalizeServiceDetail(item);
    legacyServiceDetailsCache.set(cacheKey, details);
    return details;
  }

  const hotelsDetails = await fetchPublicServiceFromHotels(serviceId, signal).catch(() => null);
  if (hotelsDetails) return hotelsDetails;

  await fetchLegacyCatalog({ page: 1, limit: 120, signal });
  const details = legacyServiceDetailsCache.get(cacheKey);
  if (details) return details;
  throw new Error(i18n.t('backend.returned', { status: response.status }));
}

export async function fetchServiceAvailability(hotelId, optionId, query = {}) {
  const params = new URLSearchParams();
  if (optionId) params.set('optionId', String(optionId));
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const response = await apiFetch(
    `/hotels/${encodeURIComponent(hotelId)}/availability?${params.toString()}`,
    { timeoutMs: 10000, skipAuth: true }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || i18n.t('backend.returned', { status: response.status }));
  return data;
}

export async function submitBookingRequest(payload) {
  const response = await apiFetch('/bookings/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || i18n.t('backend.returned', { status: response.status }));
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchMarketplaceSettings(signal) {
  const response = await apiFetch('/marketplace-settings', { signal, timeoutMs: 8000, skipAuth: true });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { bookingMode: 'manual', bookingRules: [] };
  return data.settings || data || { bookingMode: 'manual', bookingRules: [] };
}

export function resolveBookingMode(settings, service) {
  const globalMode = settings?.bookingMode || 'manual';
  if (globalMode === 'service-level') return service?.bookingMode || 'manual';
  return globalMode;
}

export async function cancelBooking(bookingId, reason) {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, cancellationReason: reason }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || i18n.t('backend.returned', { status: response.status }));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function verifyRebookId({ rebookId, serviceId }) {
  const response = await apiFetch('/rebook/verify-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rebookId, serviceId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || i18n.t('backend.returned', { status: response.status }));
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }
  return data;
}



