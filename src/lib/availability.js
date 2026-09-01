const DAY_KEYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];

const WEEKDAY_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const TIME_UNITS = new Set(['minutes', 'hours']);
const MULTI_DAY_UNITS = new Set(['days', 'nights']);
const HOURLY_PRICE = new Set(['per-hour', 'per-session']);

const toDateOnly = (value) => {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

const parseDays = (value) => {
  const days = Array.isArray(value)
    ? value.map((item) => String(item).slice(0, 3).toLowerCase()).filter(Boolean)
    : String(value || '')
      .split(/[,\s]+/)
      .map((item) => item.slice(0, 3).toLowerCase())
      .filter((item) => WEEKDAY_INDEX.includes(item));
  const unique = [...new Set(days)];
  if (unique.length >= 7) return [];
  return unique;
};

export const parseOptionAvailability = (rowOrCells = {}, listing = {}) => {
  const cells = rowOrCells?.cells || rowOrCells || {};
  const durationUnit = String(cells.durationUnit || rowOrCells?.durationUnit || '').toLowerCase();
  const priceType = String(cells.priceType || rowOrCells?.priceType || '').toLowerCase();
  const stayLike = durationUnit === 'nights' || priceType === 'per-night' || listing.domain === 'accommodation';
  const availableFrom = toDateOnly(cells.availableFrom || listing.availableFrom);
  const availableTo = toDateOnly(cells.availableTo || listing.availableTo);
  const openTime = cells.availableStartTime || cells.openTime || listing.openTime || '';
  const closeTime = cells.availableEndTime || cells.closeTime || listing.closeTime || '';
  const availableDays = parseDays(cells.availableDays || listing.availableDays);
  const explicitTime = String(cells.requiresTime || '').toLowerCase();
  const inferredTime =
    !stayLike && (
      TIME_UNITS.has(durationUnit) ||
      HOURLY_PRICE.has(priceType) ||
      Boolean(openTime && closeTime)
    );
  const requiresTime = stayLike
    ? false
    : explicitTime === 'no' || explicitTime === 'false'
    ? false
    : explicitTime === 'yes' || explicitTime === 'true' || inferredTime;
  const requiresEndDate =
    stayLike ||
    MULTI_DAY_UNITS.has(durationUnit) ||
    ['per-night', 'per-day'].includes(priceType);
  const sameDayOnly = durationUnit === 'same-day' || durationUnit === 'none';

  return {
    name: cells.service || 'Selected option',
    price: Number(cells.price || 0),
    priceType,
    durationUnit,
    maximumDuration: cells.maximumDuration || '',
    capacity: Number(cells.availability || listing.availableQuantity || 0),
    details: cells.details || '',
    availableFrom,
    availableTo,
    availableDays,
    openTime,
    closeTime,
    requiresTime,
    requiresEndDate,
    sameDayOnly,
    listingStatus: listing.status,
    listingNote: listing.availabilityText || '',
  };
};

export const optionMinDate = (option, today) => {
  const start = option.availableFrom || today;
  return start > today ? start : today;
};

export const optionMaxDate = (option) => option.availableTo || '';

export const weekdayKey = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return WEEKDAY_INDEX[date.getDay()];
};

const inTimeWindow = (value, openTime, closeTime) => {
  if (!value || !openTime || !closeTime) return true;
  if (openTime <= closeTime) return value >= openTime && value <= closeTime;
  return value >= openTime || value <= closeTime;
};

export const formatDisplayDate = (isoDate) => {
  if (!isoDate) return 'any future date';
  const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(isoDate);
  try {
    return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return String(isoDate).slice(0, 10);
  }
};

export const formatTime = (value) => {
  if (!value) return 'not set';
  const [hours, minutes] = String(value).split(':');
  const date = new Date();
  date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const formatDays = (days) => {
  if (!days?.length) return 'Every day';
  const labels = DAY_KEYS.filter(([key]) => days.includes(key)).map(([, label]) => label);
  return labels.join(', ') || 'Every day';
};

export const formatWeekday = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'that day';
  return date.toLocaleDateString([], { weekday: 'long' });
};

const dateDiffDays = (start, end) => {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b - a) / 86400000);
};

const timeDiffHours = (start, end) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
};

export const validateOptionSchedule = (option, values, today) => {
  const minDate = optionMinDate(option, today);
  const maxDate = optionMaxDate(option);
  if (!values.bookingDate) return 'Please choose a booking date.';
  if (values.bookingDate < minDate) {
    return `This option is available from ${formatDisplayDate(minDate)}. Choose a date on or after that.`;
  }
  if (maxDate && values.bookingDate > maxDate) {
    return `This option is available until ${formatDisplayDate(maxDate)}. Choose a date on or before that.`;
  }
  if (option.availableDays.length) {
    const day = weekdayKey(values.bookingDate);
    if (day && !option.availableDays.includes(day)) {
      return `This option is not available on ${formatWeekday(values.bookingDate)}. Available days: ${formatDays(option.availableDays)}.`;
    }
  }

  if (option.requiresEndDate || option.sameDayOnly) {
    const endDate = values.endBookingDate || (option.sameDayOnly ? values.bookingDate : '');
    if (!endDate) return 'Please choose an end booking date.';
    if (endDate < values.bookingDate) return 'End booking date cannot be before the booking date.';
    if (option.sameDayOnly && endDate !== values.bookingDate) {
      return 'This option is same-day only. Use the same date for start and end.';
    }
    if (maxDate && endDate > maxDate) {
      return `The stay must end by ${formatDisplayDate(maxDate)}.`;
    }
    if (option.maximumDuration && option.durationUnit === 'nights') {
      const nights = dateDiffDays(values.bookingDate, endDate);
      if (nights > Number(option.maximumDuration)) {
        return `This option allows at most ${option.maximumDuration} nights.`;
      }
    }
    if (option.maximumDuration && option.durationUnit === 'days') {
      const days = dateDiffDays(values.bookingDate, endDate) + 1;
      if (days > Number(option.maximumDuration)) {
        return `This option allows at most ${option.maximumDuration} days.`;
      }
    }
  } else if (values.endBookingDate && values.endBookingDate < values.bookingDate) {
    return 'End booking date cannot be before the booking date.';
  }

  if (option.requiresTime) {
    if (!values.startTime) {
      return option.openTime && option.closeTime
        ? `Please choose a start time between ${formatTime(option.openTime)} and ${formatTime(option.closeTime)}.`
        : 'Please choose a start time for this option.';
    }
    if (!values.endTime) {
      return option.openTime && option.closeTime
        ? `Please choose an end time between ${formatTime(option.openTime)} and ${formatTime(option.closeTime)}.`
        : 'Please choose an end time for this option.';
    }
    if (!inTimeWindow(values.startTime, option.openTime, option.closeTime)) {
      return `Start time must be within this option’s hours (${formatTime(option.openTime)}–${formatTime(option.closeTime)}).`;
    }
    if (values.endTime <= values.startTime && !(option.openTime && option.closeTime && option.openTime > option.closeTime)) {
      return 'End time must be after start time.';
    }
    if (!inTimeWindow(values.endTime, option.openTime, option.closeTime)) {
      return `End time must be within this option’s hours (${formatTime(option.openTime)}–${formatTime(option.closeTime)}).`;
    }
    if (option.maximumDuration && option.durationUnit === 'hours') {
      const hours = timeDiffHours(values.startTime, values.endTime);
      if (hours > Number(option.maximumDuration)) {
        return `This option allows at most ${option.maximumDuration} hours.`;
      }
    }
  } else if (values.startTime && values.endTime && values.endTime <= values.startTime) {
    return 'If you add times, end time must be after start time.';
  }

  return '';
};
