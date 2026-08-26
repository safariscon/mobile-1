const SKIP_ROOT_KEYS = new Set([
  'agreeToTerms',
  'totalPrice',
  'listedPriceRwf',
  'customerLocationDetails',
  'bookingAttributes',
  'bookingPayload',
  'consumption',
  'providerRules',
  'customResponses',
  'latitudeRaw',
  'longitudeRaw',
  'placeId',
  'locationSource',
  'isExactLocationVerified',
  'selectedOptionId',
  '_id',
  '__v',
]);

const SKIP_WHEN_CONSUMPTION = ['bookingDate', 'endBookingDate', 'startDate', 'endDate', 'startTime', 'endTime'];

const KEY_LABELS = {
  fullName: 'Full name',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  bookingDate: 'Booking date',
  endDate: 'End date',
  endBookingDate: 'End date',
  startTime: 'Start time',
  endTime: 'End time',
  numberOfPeople: 'Guests',
  quantity: 'Quantity',
  guests: 'Guests',
  paymentMethod: 'Payment method',
  serviceName: 'Service',
  requestedService: 'Option',
  selectedOptionId: 'Option ID',
  customerLocation: 'Customer location',
  customerCountry: 'Country',
  customerState: 'State',
  customerCity: 'City',
  customerSector: 'Area',
  bookedAt: 'Booked at',
  consumptionStartDate: 'Start date',
  pickupDateTime: 'Pickup',
  returnDateTime: 'Return',
  pickupLocation: 'Pickup location',
  returnLocation: 'Return location',
  pickupTime: 'Pickup from',
  returnTime: 'Return by',
  minRentalDays: 'Minimum rental (days)',
  maxRentalDays: 'Maximum rental (days)',
  consumptionEndDate: 'End date',
  consumptionStartTime: 'Start time',
  consumptionEndTime: 'End time',
  fullAddress: 'Address',
  formattedAddress: 'Address',
  placeName: 'Place',
  country: 'Country',
  state: 'State',
  province: 'Province',
  city: 'City',
  district: 'District',
  sector: 'Sector',
  area: 'Area',
  street: 'Street',
};

function humanizeKey(key) {
  return KEY_LABELS[key] || String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isEmpty(value) {
  if (value == null || value === '') return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.filter((item) => !isEmpty(item)).length === 0;
  if (typeof value === 'object') {
    return Object.values(value).every((item) => isEmpty(item));
  }
  return false;
}

function formatDateLike(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return '';
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const dateText = formatDateLike(value);
  if (dateText) return dateText;
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item === 'object' ? item.label || item.name || item.text || formatValue(item) : String(item)))
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object') {
    if (value.fileName) return value.fileName;
    if (value.url) return String(value.url);
    return '';
  }
  return String(value);
}

function objectRows(source, extraSkip = []) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  const skip = new Set([...SKIP_ROOT_KEYS, ...extraSkip]);
  return Object.entries(source)
    .filter(([key, value]) => {
      if (skip.has(key) || isEmpty(value)) return false;
      if (value instanceof Date) return true;
      return typeof value !== 'object';
    })
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatValue(value) }))
    .filter((row) => row.value);
}

function locationRows(location) {
  if (!location || typeof location !== 'object') return [];
  const address = location.fullAddress || location.formattedAddress || location.placeName || '';
  const area = [location.area || location.sector, location.city || location.district, location.state || location.province, location.country]
    .filter(Boolean)
    .join(', ');
  const rows = [];
  if (address) rows.push({ label: 'Address', value: address });
  if (area && area !== address) rows.push({ label: 'Area', value: area });
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0)) {
    rows.push({ label: 'Map pin', value: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
  }
  return rows;
}

function customRows(responses) {
  if (!Array.isArray(responses)) return [];
  return responses
    .map((item) => {
      const value = formatValue(item?.value ?? item?.answer);
      if (!value) return null;
      return { label: item.label || item.name || 'Response', value };
    })
    .filter(Boolean);
}

export function getBookingDetailSections(details = {}) {
  const extraSkip = [];
  if (!isEmpty(details.consumption)) extraSkip.push(...SKIP_WHEN_CONSUMPTION);
  if (!isEmpty(details.customerLocationDetails)) extraSkip.push('customerLocation');

  const fields = Object.entries(details || {})
    .filter(([key, value]) => !SKIP_ROOT_KEYS.has(key) && !extraSkip.includes(key) && !isEmpty(value))
    .flatMap(([key, value]) => {
      if (value instanceof Date) {
        const text = formatValue(value);
        return text ? [{ label: humanizeKey(key), value: text }] : [];
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) return objectRows(value, extraSkip);
      const text = formatValue(value);
      return text ? [{ label: humanizeKey(key), value: text }] : [];
    });

  const rules = (Array.isArray(details.providerRules) ? details.providerRules : [])
    .map((item) => (typeof item === 'string' ? item : item?.text || item?.label || item?.rule || ''))
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return {
    fields,
    stay: objectRows(details.bookingAttributes),
    location: locationRows(details.customerLocationDetails),
    consumption: objectRows(details.consumption),
    rules,
    custom: customRows(details.customResponses),
  };
}

export function hasBookingDetailSections(sections) {
  return Boolean(
    sections?.fields?.length
    || sections?.stay?.length
    || sections?.location?.length
    || sections?.consumption?.length
    || sections?.rules?.length
    || sections?.custom?.length
  );
}
