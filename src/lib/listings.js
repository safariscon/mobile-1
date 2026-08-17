export function listingStatusValues(item) {
  return [
    item?.status,
    item?.approvalStatus,
    item?.verificationStatus,
    item?.listingStatus,
    item?.publishStatus,
    item?.reviewStatus,
  ].map((value) => String(value || '').toLowerCase().trim());
}

export function isDraftListing(item) {
  return listingStatusValues(item).some((value) => value === 'draft' || value === 'drafts');
}

export function reviewStatusOf(item) {
  const values = listingStatusValues(item);
  if (values.includes('rejected')) return 'rejected';
  if (values.includes('approved') || values.includes('posted') || values.includes('available')) return 'approved';
  if (values.includes('pending') || values.includes('pending_review') || values.includes('under_review')) return 'pending';
  return values.find(Boolean) || 'pending';
}

export function matchesServiceFilter(item, filter) {
  if (isDraftListing(item)) return false;
  if (!filter || filter === 'all') return true;
  return reviewStatusOf(item) === filter;
}
