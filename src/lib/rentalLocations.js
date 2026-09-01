/** Reads pickup/return addresses the provider configured on the listing. */
export function resolveRentalLocations(listing = {}) {
  const record = listing && typeof listing === 'object' ? listing : {};
  const attrs = record.listingAttributes && typeof record.listingAttributes === 'object'
    ? record.listingAttributes
    : record;
  const catalog = record.catalogLocation && typeof record.catalogLocation === 'object'
    ? record.catalogLocation
    : (record.serviceLocation && typeof record.serviceLocation === 'object' ? record.serviceLocation : {});
  const addressFallback = String(
    catalog.formattedAddress
    || catalog.fullAddress
    || (typeof record.location === 'string' ? record.location : '')
    || ''
  ).trim();
  const pickupLocation = String(attrs.pickupLocation || '').trim() || addressFallback;
  const returnLocation = String(attrs.returnLocation || '').trim() || pickupLocation;
  return { pickupLocation, returnLocation };
}
