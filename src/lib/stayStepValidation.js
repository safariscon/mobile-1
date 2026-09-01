import { mapBookingToSchedule, validateBookingClient } from '../features/domain/registry';
import { validateOptionSchedule } from './availability';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function mapScheduleErrorToFieldErrors(domain, message = '') {
  const lower = String(message).toLowerCase();
  if (!message) return {};

  if (domain === 'accommodation') {
    if (
      lower.includes('end booking')
      || lower.includes('check-out')
      || lower.includes('checkout')
      || lower.includes('nights')
      || lower.includes('stay must end')
      || lower.includes('after check-in')
      || lower.includes('before the booking date')
    ) {
      return { checkOut: message };
    }
    if (lower.includes('end time')) return { checkOut: message };
    if (lower.includes('start time')) return { checkIn: message };
    return { checkIn: message };
  }

  if (domain === 'transport') {
    if (
      lower.includes('return')
      || lower.includes('end time')
      || lower.includes('end booking')
    ) {
      return { returnDateTime: message };
    }
    if (lower.includes('start time') || lower.includes('pickup')) {
      return { pickupDateTime: message };
    }
    return { pickupDateTime: message };
  }

  return {};
}

export function mapApiErrorToStayFieldErrors(domain, message = '') {
  const lower = String(message).toLowerCase();
  if (!message) return {};

  if (domain === 'accommodation') {
    if (lower.includes('check-out') || lower.includes('checkout') || lower.includes('nights') || lower.includes('stay')) {
      return { checkOut: message };
    }
    if (lower.includes('check-in') || lower.includes('checkin')) return { checkIn: message };
    return mapScheduleErrorToFieldErrors(domain, message);
  }

  if (domain === 'transport') {
    if (lower.includes('return')) return { returnDateTime: message };
    if (lower.includes('pickup')) return { pickupDateTime: message };
    return mapScheduleErrorToFieldErrors(domain, message);
  }

  return mapScheduleErrorToFieldErrors(domain, message);
}

export function validateStayStepBooking({
  domain,
  stayAttributes,
  optionSchedule,
  bookingValues = {},
  today = todayIso(),
  listing = {},
  inventory = {},
}) {
  const fieldErrors = validateBookingClient(domain, stayAttributes, { listing, inventory });
  if (Object.keys(fieldErrors).length) {
    return {
      fieldErrors,
      message: Object.values(fieldErrors)[0] || 'Complete the required stay details.',
    };
  }

  const mapped = mapBookingToSchedule(domain, stayAttributes);
  const scheduleError = validateOptionSchedule(
    optionSchedule,
    {
      ...bookingValues,
      bookingDate: mapped.startDate || bookingValues.bookingDate,
      endBookingDate: mapped.endDate || bookingValues.endBookingDate,
      startTime: mapped.startTime || bookingValues.startTime,
      endTime: mapped.endTime || bookingValues.endTime,
    },
    today
  );

  if (scheduleError) {
    return {
      fieldErrors: mapScheduleErrorToFieldErrors(domain, scheduleError),
      message: scheduleError,
    };
  }

  return { fieldErrors: {}, message: '' };
}
