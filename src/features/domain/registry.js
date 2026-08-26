const SLUG_TO_DOMAIN = {
  hotel: 'accommodation',
  apartment: 'accommodation',
  homestay: 'accommodation',
  'guest-house': 'accommodation',
  'bed-and-breakfast': 'accommodation',
  hostel: 'accommodation',
  'car-rental': 'transport',
  taxi: 'transport',
  motorbike: 'transport',
  tour: 'experiences',
  'activity-operator': 'experiences',
  restaurant: 'dining',
  cafe: 'dining',
  bar: 'dining',
  conference: 'venues',
  'event-hall': 'venues',
};

const SLUG_ALIASES = {
  'car-rentals': 'car-rental',
  cars: 'car-rental',
  'motorbike-and-scooter-rentals': 'motorbike',
  'taxi-and-ride-services': 'taxi',
  'bus-and-minivan-charters': 'taxi',
};

export const INVENTORY_LABELS = {
  accommodation: { singular: 'Room', plural: 'Rooms' },
  transport: { singular: 'Vehicle', plural: 'Vehicles' },
  experiences: { singular: 'Package', plural: 'Packages' },
  dining: { singular: 'Offer', plural: 'Offers' },
  venues: { singular: 'Package', plural: 'Packages' },
};

export function normalizeCategorySlug(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[ /]+/g, '-');
  return SLUG_ALIASES[raw] || raw;
}

function slugCandidates(categoryOrSlug) {
  if (!categoryOrSlug) return [];
  if (typeof categoryOrSlug === 'string') return [normalizeCategorySlug(categoryOrSlug)].filter(Boolean);
  const nested = categoryOrSlug.category && typeof categoryOrSlug.category === 'object'
    ? categoryOrSlug.category
    : null;
  return [
    categoryOrSlug.categorySlug,
    nested?.slug,
    nested?.categorySlug,
    typeof categoryOrSlug.category === 'string' ? categoryOrSlug.category : '',
    categoryOrSlug.slug,
    categoryOrSlug.subtype,
    nested?.subtype,
    categoryOrSlug.type,
    nested?.type,
    categoryOrSlug.serviceType,
    categoryOrSlug.serviceCategory,
  ].map(normalizeCategorySlug).filter(Boolean);
}

function inferTransportSubtype(categoryOrSlug) {
  const attrs = categoryOrSlug?.listingAttributes || categoryOrSlug || {};
  if (attrs.vehicleClass || attrs.pickupTime || attrs.returnTime || attrs.minRentalDays || attrs.maxRentalDays) {
    return 'car-rental';
  }
  if (attrs.helmetIncluded != null) return 'motorbike';
  if (attrs.vehicleType) return 'taxi';
  return '';
}

function readSlug(categoryOrSlug) {
  const candidates = slugCandidates(categoryOrSlug);
  const domainHint = typeof categoryOrSlug === 'object' ? categoryOrSlug.domain : '';
  const known = candidates.find((slug) => {
    const mapped = SLUG_TO_DOMAIN[slug];
    if (!mapped) return false;
    if (domainHint === 'transport' && mapped === 'accommodation') return false;
    if (domainHint === 'accommodation' && mapped === 'transport') return false;
    return true;
  });
  if (known) return known;
  if (domainHint === 'transport') return inferTransportSubtype(categoryOrSlug) || candidates[0] || '';
  return candidates[0] || '';
}

export function resolveDomain(categoryOrSlug) {
  if (!categoryOrSlug) return 'experiences';
  const slug = readSlug(categoryOrSlug);
  if (SLUG_TO_DOMAIN[slug]) return SLUG_TO_DOMAIN[slug];
  if (typeof categoryOrSlug === 'object' && categoryOrSlug.domain) return categoryOrSlug.domain;
  return 'experiences';
}

export function resolveSubtype(categoryOrSlug) {
  return readSlug(categoryOrSlug);
}

export function isStayCategory(categoryOrSlug) {
  return resolveDomain(categoryOrSlug) === 'accommodation';
}

export function isRangeOccupancyCategory(categoryOrSlug) {
  const domain = resolveDomain(categoryOrSlug);
  const subtype = resolveSubtype(categoryOrSlug);
  if (domain === 'accommodation') return true;
  return domain === 'transport' && (subtype === 'car-rental' || subtype === 'motorbike');
}

export function splitDateTimeValue(value) {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    return { date: text.slice(0, 10), time: text.slice(11, 16) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { date: text, time: '' };
  return { date: '', time: '' };
}

export function joinDateTimeValue(date, time) {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

export function rangeDays(startDate, endDate) {
  const start = String(startDate || '').slice(0, 10);
  const end = String(endDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start) return 0;
  return Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000);
}

export function domainCopy(categoryOrSlug) {
  const domain = resolveDomain(categoryOrSlug);
  const subtype = resolveSubtype(categoryOrSlug);
  if (domain === 'accommodation') {
    return { kind: 'stay', rangeMode: true, optionNoun: 'room type', unitNoun: 'room', unitNounPlural: 'rooms', capacityLabel: 'Rooms of this type', startLabel: 'Check-in', endLabel: 'Check-out' };
  }
  if (domain === 'transport' && subtype === 'car-rental') {
    return { kind: 'rental', rangeMode: true, optionNoun: 'vehicle type', unitNoun: 'car', unitNounPlural: 'cars', capacityLabel: 'Number of cars of this type', startLabel: 'Pickup', endLabel: 'Return' };
  }
  if (domain === 'transport' && subtype === 'motorbike') {
    return { kind: 'rental', rangeMode: true, optionNoun: 'bike type', unitNoun: 'bike', unitNounPlural: 'bikes', capacityLabel: 'Number of bikes of this type', startLabel: 'Pickup', endLabel: 'Return' };
  }
  return { kind: 'option', rangeMode: false, optionNoun: 'option', unitNoun: 'unit', unitNounPlural: 'units', capacityLabel: 'Capacity', startLabel: 'Start', endLabel: 'End' };
}

export function remainingPaymentOptions(categoryOrSlug) {
  const copy = domainCopy(categoryOrSlug);
  if (copy.kind === 'rental') {
    return [
      ['PAY_AT_ARRIVAL', 'Pay at pickup'],
      ['PAY_AT_CHECKOUT', 'Pay at return'],
      ['PAY_AT_BOOKING', 'Pay full amount at booking'],
    ];
  }
  return [
    ['PAY_AT_ARRIVAL', 'Pay at arrival'],
    ['PAY_AT_CHECKOUT', 'Pay at checkout'],
    ['PAY_AT_BOOKING', 'Pay full amount at booking'],
  ];
}

export function remainingPaymentLabel(method, categoryOrSlug) {
  const code = String(method || '').trim().toUpperCase();
  if (!code) return '';
  const match = remainingPaymentOptions(categoryOrSlug).find((option) => option[0] === code);
  return match ? match[1] : code.replace(/_/g, ' ');
}

export const CAR_FUEL_TYPES = [
  ['Petrol', 'Petrol (regular unleaded)'],
  ['Diesel', 'Diesel'],
  ['Hybrid / Electric', 'Hybrid / Electric'],
];

export function emptyListingValues(domain, subtype) {
  if (domain === 'accommodation') {
    return {
      checkInTime: '14:00',
      checkOutTime: '11:00',
      checkInFrom: '14:00',
      checkInUntil: '22:00',
      checkOutFrom: '07:00',
      checkOutUntil: '11:00',
      starRating: 'unrated',
      amenities: 'wifi',
      allowsChildren: 'yes',
      allowsPets: 'no',
      childrenStayFree: true,
      firstCheckInMode: 'asap',
      availabilityHorizonDays: 365,
      allowLongStays: false,
      hostIdentity: { legalName: '', idType: 'national_id', idNumber: '', billingSameAsProperty: true },
    };
  }
  if (domain === 'transport' && subtype === 'car-rental') {
    return { vehicleClass: '', transmission: '', withDriver: false, fuelType: 'Petrol', fuelPolicy: 'Full-to-full', insuranceIncluded: false, minimumDriverAge: 21, depositNote: '', pickupTime: '08:00', returnTime: '18:00', minRentalDays: 1, maxRentalDays: 30 };
  }
  if (domain === 'transport' && subtype === 'taxi') return { vehicleType: '' };
  if (domain === 'transport' && subtype === 'motorbike') return { helmetIncluded: true, minimumDriverAge: 18 };
  if (domain === 'experiences') return { duration: '', difficulty: 'Easy', meetingPoint: '', included: '', excluded: '' };
  if (domain === 'dining') return { cuisine: '', dressCode: '', atmosphere: '', averagePrice: '', seatingCapacity: '', openingHours: '' };
  if (domain === 'venues') return { maxCapacity: '', amenities: '', cateringAvailable: false };
  return {};
}

export function emptyInventoryValues(domain) {
  if (domain === 'accommodation') return { maxGuests: 2, bedType: '', numberOfBeds: 1, bedrooms: 1, quantity: 1 };
  if (domain === 'transport') return { make: '', model: '', seats: 4, luggage: '', ac: true, quantity: 1 };
  if (domain === 'experiences') return { packageType: 'Adult' };
  if (domain === 'venues') return { packageName: '' };
  return {};
}

export function emptyBookingValues(domain) {
  if (domain === 'accommodation') return { checkIn: '', checkOut: '', guests: 1, ratePlan: 'standard', specialRequests: '' };
  if (domain === 'transport') {
    return { pickupLocation: '', returnLocation: '', dropoffLocation: '', pickupDateTime: '', returnDateTime: '', driverAge: '', driverLicenseNumber: '', numberOfDrivers: 1 };
  }
  if (domain === 'experiences') {
    return { preferredDate: '', participants: 1, adults: 1, children: 0, language: '', pickupRequired: false, specialRequirements: '' };
  }
  if (domain === 'dining') return { reservationDateTime: '', partySize: 2, allergies: '', specialRequests: '' };
  if (domain === 'venues') return { eventDate: '', startTime: '', endTime: '', attendees: 10, setupStyle: '', avNeeds: '', catering: '' };
  return {};
}

export function validateListingClient(domain, subtype, values = {}) {
  const errors = {};
  if (domain === 'accommodation') {
    if (!values.checkInTime) errors.checkInTime = 'Check-in time is required.';
    if (!values.checkOutTime) errors.checkOutTime = 'Check-out time is required.';
  }
  if (domain === 'transport' && subtype === 'car-rental') {
    if (!values.vehicleClass) errors.vehicleClass = 'Vehicle class is required.';
    if (!values.transmission) errors.transmission = 'Transmission is required.';
    if (Number(values.minimumDriverAge) < 18) errors.minimumDriverAge = 'Minimum age must be at least 18.';
    if (values.minRentalDays != null && values.minRentalDays !== '' && !(Number(values.minRentalDays) >= 1)) {
      errors.minRentalDays = 'Minimum rental must be at least 1 day.';
    }
    if (Number(values.minRentalDays) > 0 && Number(values.maxRentalDays) > 0 && Number(values.maxRentalDays) < Number(values.minRentalDays)) {
      errors.maxRentalDays = 'Maximum rental must be at least the minimum.';
    }
  }
  if (domain === 'transport' && subtype === 'taxi' && !values.vehicleType) errors.vehicleType = 'Vehicle type is required.';
  if (domain === 'experiences' && !values.duration) errors.duration = 'Duration is required.';
  if (domain === 'dining') {
    if ((subtype === 'restaurant' || subtype === 'cafe') && !values.cuisine) errors.cuisine = 'Cuisine is required.';
    if (!(Number(values.seatingCapacity) > 0)) errors.seatingCapacity = 'Seating capacity is required.';
  }
  if (domain === 'venues' && !(Number(values.maxCapacity) > 0)) errors.maxCapacity = 'Max capacity is required.';
  return errors;
}

export function validateInventoryClient(domain, values = {}) {
  const errors = {};
  if (domain === 'accommodation' && !(Number(values.maxGuests) > 0)) errors.maxGuests = 'Max guests is required.';
  if (domain === 'transport' && values.quantity !== '' && values.quantity != null && !(Number(values.quantity) > 0)) {
    errors.quantity = 'Number of vehicles must be at least 1.';
  }
  return errors;
}

export function validateBookingClient(domain, values = {}, { listing = {}, inventory = {} } = {}) {
  const errors = {};
  const listingDetails = listing.listingAttributes || {};
  const inventoryDetails = inventory.attributes || inventory;
  if (domain === 'accommodation') {
    if (!values.checkIn) errors.checkIn = 'Check-in is required.';
    if (!values.checkOut) errors.checkOut = 'Check-out is required.';
    if (values.checkIn && values.checkOut && values.checkOut <= values.checkIn) errors.checkOut = 'Check-out must be after check-in.';
    if (!(Number(values.guests) > 0)) errors.guests = 'Guests must be at least 1.';
    if (Number(inventoryDetails.maxGuests) > 0 && Number(values.guests) > Number(inventoryDetails.maxGuests)) {
      errors.guests = `Maximum ${inventoryDetails.maxGuests} guests for this room.`;
    }
  }
  if (domain === 'transport') {
    if (!values.pickupLocation) errors.pickupLocation = 'Pickup location is required.';
    if (!values.pickupDateTime) errors.pickupDateTime = 'Pickup date/time is required.';
    if (listing.subtype === 'taxi' || listing.categorySlug === 'taxi' || listing.slug === 'taxi') {
      if (!values.dropoffLocation) errors.dropoffLocation = 'Drop-off location is required.';
    } else {
      if (!values.returnLocation) errors.returnLocation = 'Return location is required.';
      if (!values.returnDateTime) errors.returnDateTime = 'Return date is required.';
      const pickup = splitDateTimeValue(values.pickupDateTime);
      const ret = splitDateTimeValue(values.returnDateTime);
      if (pickup.date && ret.date && ret.date <= pickup.date) errors.returnDateTime = 'Return date must be after pickup date.';
      const minDays = Number(listingDetails.minRentalDays) || 1;
      const maxDays = Number(listingDetails.maxRentalDays) || 0;
      const days = rangeDays(pickup.date, ret.date);
      if (days > 0 && days < minDays) errors.returnDateTime = `Minimum rental is ${minDays} day${minDays === 1 ? '' : 's'}.`;
      if (days > 0 && maxDays > 0 && days > maxDays) errors.returnDateTime = `Maximum rental is ${maxDays} day${maxDays === 1 ? '' : 's'}.`;
    }
    if (listing.subtype === 'car-rental' || listing.categorySlug === 'car-rental' || listing.slug === 'car-rental') {
      if (!(Number(values.driverAge) >= 18)) errors.driverAge = 'Driver age must be at least 18.';
      if (!listingDetails.withDriver && !values.driverLicenseNumber) errors.driverLicenseNumber = 'Driver license number is required.';
    }
  }
  if (domain === 'experiences') {
    if (!values.preferredDate) errors.preferredDate = 'Date is required.';
    if (!(Number(values.participants) > 0)) errors.participants = 'Participants must be at least 1.';
  }
  if (domain === 'dining') {
    if (!values.reservationDateTime) errors.reservationDateTime = 'Reservation date/time is required.';
    if (!(Number(values.partySize) > 0)) errors.partySize = 'Party size must be at least 1.';
  }
  if (domain === 'venues') {
    if (!values.eventDate) errors.eventDate = 'Event date is required.';
    if (!values.startTime) errors.startTime = 'Start time is required.';
    if (!values.endTime) errors.endTime = 'End time is required.';
    if (!(Number(values.attendees) > 0)) errors.attendees = 'Attendees must be at least 1.';
  }
  return errors;
}

export function mapBookingToSchedule(domain, values = {}) {
  if (domain === 'accommodation') {
    return { startDate: values.checkIn, endDate: values.checkOut, startTime: '', endTime: '', numberOfPeople: Number(values.guests) || 1, guests: Number(values.guests) || 1 };
  }
  if (domain === 'transport') {
    const pickup = String(values.pickupDateTime || '');
    const ret = String(values.returnDateTime || pickup);
    return {
      startDate: pickup.slice(0, 10),
      endDate: ret.slice(0, 10) || pickup.slice(0, 10),
      startTime: pickup.includes('T') ? pickup.slice(11, 16) : '',
      endTime: ret.includes('T') ? ret.slice(11, 16) : '',
      numberOfPeople: Number(values.numberOfDrivers) || 1,
      guests: Number(values.numberOfDrivers) || 1,
    };
  }
  if (domain === 'experiences') {
    return { startDate: values.preferredDate, endDate: values.preferredDate, startTime: '', endTime: '', numberOfPeople: Number(values.participants) || 1, guests: Number(values.participants) || 1 };
  }
  if (domain === 'dining') {
    const when = String(values.reservationDateTime || '');
    return { startDate: when.slice(0, 10), endDate: when.slice(0, 10), startTime: when.includes('T') ? when.slice(11, 16) : '', endTime: '', numberOfPeople: Number(values.partySize) || 1, guests: Number(values.partySize) || 1 };
  }
  if (domain === 'venues') {
    return { startDate: values.eventDate, endDate: values.eventDate, startTime: values.startTime, endTime: values.endTime, numberOfPeople: Number(values.attendees) || 1, guests: Number(values.attendees) || 1 };
  }
  return { startDate: '', endDate: '', startTime: '', endTime: '', numberOfPeople: 1, guests: 1 };
}

export function firstError(errors = {}) {
  return Object.values(errors)[0] || '';
}
