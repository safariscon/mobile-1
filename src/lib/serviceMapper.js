import i18n from '../i18n';

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function labelFromSlug(value) {
  if (!value || typeof value !== 'string') return value || '';
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function numberFrom(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

export function formatMoney(value, currency = 'RWF') {
  const amount = numberFrom(value);
  return amount > 0 ? `${currency} ${amount.toLocaleString()}` : i18n.t('serviceDetails.contactForPrice');
}

const INVENTORY_LABELS = {
  available: 'Available',
  limited: 'Limited Availability',
  'fully-booked': 'Fully Booked',
  'out-of-stock': 'Out of Stock',
  'temporarily-unavailable': 'Temporarily Unavailable',
  unavailable: 'Out of Stock',
  inactive: 'Out of Stock',
  'sold-out': 'Fully Booked',
};

export function inventoryStatusLabel(status) {
  const key = String(status || 'available').toLowerCase().trim();
  return INVENTORY_LABELS[key] || labelFromSlug(key) || 'Available';
}

export function serviceApprovalStatus(service) {
  const status = String(firstValue(service?.approvalStatus, service?.status, service?.seller?.status, 'pending') || '').toLowerCase();
  if (status.includes('approve')) return 'approved';
  if (status.includes('reject')) return 'rejected';
  return 'pending';
}

export function collectImages(service) {
  const images = [];
  const pushImage = (entry, index) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      images.push({ url: entry, alt: `${service?.title || service?.name || 'Service'} ${index + 1}` });
      return;
    }
    const url = firstValue(entry.url, entry.secure_url, entry.path, entry.src);
    if (url) images.push({ url, alt: firstValue(entry.alt, entry.caption, `${service?.title || service?.name || 'Service'} ${index + 1}`) });
  };

  if (service?.primaryImage) pushImage(service.primaryImage, 0);
  if (Array.isArray(service?.images)) service.images.forEach(pushImage);
  if (Array.isArray(service?.imageUrls)) service.imageUrls.forEach((url, index) => pushImage(url, index));
  if (Array.isArray(service?.photos)) service.photos.forEach(pushImage);
  // Dedupe by URL while keeping primary first
  const seen = new Set();
  return images.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

export function resolveServiceLocation(service) {
  const map = service?.map || {};
  const serviceLocation = service?.serviceLocation || service?.locationDetails || service?.location || {};
  const latitude = numberFrom(map.latitude, serviceLocation.latitude, serviceLocation.lat);
  const longitude = numberFrom(map.longitude, serviceLocation.longitude, serviceLocation.lng, serviceLocation.lon);
  const formattedAddress = firstValue(
    map.formattedAddress,
    serviceLocation.formattedAddress,
    serviceLocation.fullAddress,
    service?.address,
    [serviceLocation.city, serviceLocation.state, serviceLocation.country].filter(Boolean).join(', ')
  );
  const hasCoordinates = latitude !== 0 || longitude !== 0;
  const googleMapsUrl = firstValue(
    map.googleMapsUrl,
    hasCoordinates ? `https://www.google.com/maps?q=${latitude},${longitude}` : ''
  );
  const osmUrl = firstValue(
    map.osmUrl,
    hasCoordinates ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}` : ''
  );

  return {
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
    formattedAddress: formattedAddress || '',
    googleMapsUrl,
    osmUrl,
    district: firstValue(service?.generalLocation, serviceLocation.district, serviceLocation.city, service?.destinationLocation),
    country: serviceLocation.country || '',
    state: serviceLocation.state || serviceLocation.province || '',
    city: serviceLocation.city || '',
  };
}

export const OPTION_PRICING_KEYS = ['priceType', 'calculationField', 'durationUnit', 'maximumDuration'];
export const OPTION_AVAILABILITY_KEYS = [
  'availability',
  'availableFrom',
  'availableTo',
  'availableDays',
  'availableStartTime',
  'availableEndTime',
  'requiresTime',
];
export const OPTION_NAME_KEYS = ['service', 'name', 'option'];
export const OPTION_DETAIL_KEYS = ['details', 'amenities', 'description'];

export const OPTION_CELL_LABELS = {
  priceType: 'Price type',
  calculationField: 'Calculated by',
  durationUnit: 'Duration unit',
  maximumDuration: 'Maximum duration',
  availability: 'Capacity',
  availableFrom: 'Available from',
  availableTo: 'Available until',
  availableDays: 'Available days',
  availableStartTime: 'Start time',
  availableEndTime: 'End time',
  requiresTime: 'Time required',
  price: 'Price',
};

function formatCellValue(key, value) {
  if (value === undefined || value === null || value === '') return '';
  if (['availableFrom', 'availableTo'].includes(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  if (key === 'requiresTime') return value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function normalizeAvailabilityTable(service) {
  const table = service?.availabilityTable || {};
  const columns = Array.isArray(table.columns) && table.columns.length
    ? table.columns.map((column, index) => ({
        id: String(firstValue(column.id, column.key, `column-${index + 1}`)),
        label: firstValue(column.label, column.title, labelFromSlug(column.id || column.key)),
      }))
    : [
        { id: 'service', label: 'Option' },
        { id: 'price', label: 'Price' },
        { id: 'priceType', label: 'Price type' },
        { id: 'details', label: 'Details' },
      ];

  const rows = Array.isArray(table.rows)
    ? table.rows.map((row, index) => {
        const cells = { ...(row?.cells || {}) };
        const optionName = firstValue(...OPTION_NAME_KEYS.map((key) => cells[key]), `Option ${index + 1}`);
        const price = numberFrom(cells.price, cells.amount, cells.rate);
        const currency = firstValue(cells.currency, 'RWF');
        const knownKeys = new Set([
          ...OPTION_NAME_KEYS,
          ...OPTION_PRICING_KEYS,
          ...OPTION_AVAILABILITY_KEYS,
          ...OPTION_DETAIL_KEYS,
          'price',
          'amount',
          'rate',
          'currency',
          'priceText',
        ]);
        const extraCells = Object.entries(cells)
          .filter(([key, value]) => !knownKeys.has(key) && value !== undefined && value !== null && value !== '')
          .map(([key, value]) => ({
            key,
            label: columns.find((column) => column.id === key)?.label || OPTION_CELL_LABELS[key] || labelFromSlug(key),
            value: formatCellValue(key, value),
          }));

        return {
          id: String(firstValue(row?.id, `row-${index + 1}`)),
          sortOrder: row?.sortOrder ?? index,
          optionName,
          price,
          priceText: firstValue(cells.priceText, formatMoney(price, currency)),
          priceType: firstValue(cells.priceType, cells.pricingType),
          cells,
          pricingRules: OPTION_PRICING_KEYS
            .map((key) => ({ key, label: OPTION_CELL_LABELS[key], value: formatCellValue(key, cells[key]) }))
            .filter((item) => item.value),
          availabilityRules: OPTION_AVAILABILITY_KEYS
            .map((key) => ({ key, label: OPTION_CELL_LABELS[key], value: formatCellValue(key, cells[key]) }))
            .filter((item) => item.value),
          details: firstValue(cells.details, cells.amenities, cells.description, ''),
          amenities: Array.isArray(cells.amenities)
            ? cells.amenities.filter(Boolean)
            : String(cells.amenities || '').split(',').map((item) => item.trim()).filter(Boolean),
          extraCells,
        };
      })
    : [];

  return { columns, rows, updatedAt: table.updatedAt || null };
}

export function normalizeServiceDetail(item, index = 0) {
  const id = String(firstValue(item._id, item.id, item.slug, index));
  const title = firstValue(item.title, item.name, item.displayName, item.businessName, item.hotelName, `${i18n.t('serviceDetails.service')} ${index + 1}`);
  const rawCategory = firstValue(
    typeof item.category === 'string' ? item.category : null,
    item.category?.slug,
    item.category?.name,
    item.type,
    item.serviceType,
    item.businessType,
    i18n.t('serviceDetails.service')
  );
  const location = resolveServiceLocation(item);
  const images = collectImages(item);
  const imageUrls = images.map((image) => image.url);
  const availabilityTable = normalizeAvailabilityTable(item);
  const inventoryStatus = firstValue(item.inventoryStatus, item.status);
  const availableQuantity = numberFrom(item.availableQuantity, item.quantityRemaining, item.availableInventory, item.inventory);
  const priceAmount = numberFrom(item.pricing?.amount, item.price, item.startingPrice, item.basePrice, item.minPrice);
  const apiOptions = Array.isArray(item.options) ? item.options : [];
  const options = apiOptions.length
    ? apiOptions.map((option, optionIndex) => ({
        id: String(firstValue(option._id, option.id, `option_${optionIndex}`)),
        name: firstValue(option.name, option.title, i18n.t('serviceDetails.serviceOption')),
        price: numberFrom(option.price, 0),
        priceText: formatMoney(numberFrom(option.price, 0)),
        pricingType: labelFromSlug(option.priceType) || i18n.t('serviceDetails.standard'),
        durationUnit: firstValue(option.durationUnit, i18n.t('serviceDetails.use')),
        duration: firstValue(option.maximumDuration, ''),
        maximumCapacity: Math.max(1, numberFrom(option.capacity, availableQuantity, 1)),
        details: firstValue(option.details, ''),
        amenities: [],
        availabilityStatus: option.isActive === false ? inventoryStatusLabel('unavailable') : inventoryStatusLabel(inventoryStatus),
        pricingRules: [],
        availabilityRules: [],
        extraCells: [],
        cells: {},
        attributes: option.attributes || {},
        raw: option,
      }))
    : availabilityTable.rows.length
    ? availabilityTable.rows.map((row) => ({
        id: row.id,
        name: row.optionName,
        price: row.price,
        priceText: row.priceText,
        pricingType: labelFromSlug(row.priceType) || i18n.t('serviceDetails.standard'),
        durationUnit: firstValue(row.cells.durationUnit, row.cells.unit, i18n.t('serviceDetails.use')),
        duration: firstValue(row.cells.maximumDuration, row.cells.duration, row.cells.nights, row.cells.hours, ''),
        maximumCapacity: Math.max(1, numberFrom(row.cells.availability, row.cells.maximumCapacity, row.cells.capacity, availableQuantity, 1)),
        details: row.details,
        amenities: row.amenities,
        availabilityStatus: numberFrom(row.cells.availability) > 0
          ? inventoryStatusLabel('available')
          : inventoryStatusLabel(inventoryStatus),
        pricingRules: row.pricingRules,
        availabilityRules: row.availabilityRules,
        extraCells: row.extraCells,
        cells: row.cells,
      }))
    : [{
        id,
        name: i18n.t('serviceDetails.serviceOption'),
        price: priceAmount,
        priceText: firstValue(item.priceText, formatMoney(priceAmount)),
        pricingType: i18n.t('serviceDetails.standard'),
        durationUnit: i18n.t('serviceDetails.use'),
        duration: '',
        maximumCapacity: Math.max(1, availableQuantity || 1),
        details: firstValue(item.description, ''),
        amenities: [],
        availabilityStatus: inventoryStatusLabel(inventoryStatus),
        pricingRules: [],
        availabilityRules: [],
        extraCells: [],
        cells: {},
      }];

  const categoryName = firstValue(
    item.category?.name,
    item.categoryName,
    typeof item.category === 'string' ? labelFromSlug(item.category) : null,
    labelFromSlug(rawCategory)
  );

  const provider = {
    name: firstValue(item.provider?.name, item.providerName, item.sellerName, item.businessName),
    email: firstValue(item.provider?.email, item.providerEmail, item.contactDetails?.email),
    phone: firstValue(
      item.provider?.phone,
      item.contactDetails?.phoneE164,
      item.contactDetails?.phone,
      item.contactDetails?.whatsappE164,
      item.contactDetails?.whatsapp
    ),
    sellerId: firstValue(item.provider?.sellerId, item.sellerId, item.providerId),
  };

  return {
    id,
    hotelId: String(firstValue(item.hotelId, item._id, item.id, id)),
    title,
    name: title,
    description: firstValue(item.description, item.shortDescription, item.summary, i18n.t('serviceDetails.privacyDescription')),
    category: categoryName,
    serviceType: typeof rawCategory === 'string' ? rawCategory : (rawCategory?.slug || categoryName),
    categoryId: firstValue(item.categoryId, item.category?._id, item.category?.id),
    schemaSnapshot: item.schemaSnapshot || null,
    listingAttributes: item.listingAttributes || {},
    basePrice: numberFrom(item.basePrice, priceAmount),
    platformCommissionPercent: numberFrom(item.platformCommissionPercent, item.commissionPercentage),
    agreementTerms: item.agreementTerms || null,
    primaryImage: firstValue(item.primaryImage, imageUrls[0]),
    supportsOptions: item.supportsOptions !== false && item.category?.supportsOptions !== false,
    status: firstValue(item.status, inventoryStatus, 'available'),
    inventoryStatus,
    inventoryStatusLabel: inventoryStatusLabel(inventoryStatus),
    bookingMode: firstValue(item.bookingMode, item.automaticBooking ? 'automatic' : 'manual'),
    priceText: firstValue(item.priceText, formatMoney(priceAmount)),
    pricing: item.pricing || { amount: priceAmount, currency: 'RWF', unit: firstValue(item.pricing?.unit, item.durationUnit) },
    cancelWindowHours: numberFrom(item.cancelWindowHours, item.cancellationPolicy?.windowHours),
    cancelPenaltyPercent: numberFrom(item.cancelPenaltyPercent, item.cancellationPolicy?.penaltyPercent),
    cancellationPolicy: item.cancellationPolicy || {
      windowHours: numberFrom(item.cancelWindowHours, item.cancellationPolicy?.windowHours),
      penaltyPercent: numberFrom(item.cancelPenaltyPercent, item.cancellationPolicy?.penaltyPercent),
    },
    availabilityText: firstValue(item.availabilityText, item.customAvailability, inventoryStatusLabel(inventoryStatus)),
    availableQuantity,
    images: imageUrls,
    imageItems: images,
    map: {
      latitude: location.latitude,
      longitude: location.longitude,
      formattedAddress: location.formattedAddress,
      googleMapsUrl: location.googleMapsUrl,
      osmUrl: location.osmUrl,
    },
    serviceLocation: item.serviceLocation || item.locationDetails || item.location || {},
    location,
    generalLocation: firstValue(item.generalLocation, location.district, location.formattedAddress, i18n.t('common.rwanda')),
    provider,
    providerName: provider.name,
    sellerId: provider.sellerId,
    contactDetails: item.contactDetails || {},
    amenities: Array.isArray(item.amenities) ? item.amenities.filter(Boolean) : [],
    availabilityTable,
    options,
    bookingForm: item.bookingForm || { fields: [] },
    bookingRules: item.bookingRules || {},
    promotion: item.promotion || item.primaryService?.promotion || null,
    approvalStatus: serviceApprovalStatus(item),
    isFeatured: Boolean(item.isFeatured || item.featured),
    rating: numberFrom(item.rating, item.averageRating, item.reviewScore, 0),
    reviewCount: numberFrom(item.reviewCount, item.reviewsCount),
    seller: {
      verified: serviceApprovalStatus(item) === 'approved',
      status: firstValue(item.approvalStatus, item.status, 'pending'),
    },
    pricingType: labelFromSlug(firstValue(options[0]?.priceType, item.pricing?.unit)) || i18n.t('serviceDetails.standard'),
    durationUnit: firstValue(options[0]?.durationUnit, item.durationUnit, i18n.t('serviceDetails.use')),
    maximumCapacity: Math.max(1, numberFrom(options[0]?.maximumCapacity, availableQuantity, 1)),
    availabilityStatus: inventoryStatusLabel(inventoryStatus),
    sourceType: item.sourceType || (item.hotelId ? 'service' : 'hotel'),
  };
}

export function findServiceInHotelsPayload(payload, serviceId) {
  const targetId = String(serviceId);
  const items = Array.isArray(payload?.hotels)
    ? payload.hotels
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.services)
          ? payload.services
          : [];
  return items.find((item) => [item._id, item.id, item.hotelId, item.slug].some((value) => value !== undefined && String(value) === targetId)) || null;
}
