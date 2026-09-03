/**
 * Shared service workspace steps for view / add / edit.
 */

export const SERVICE_STEP_IDS = ['basics', 'details', 'options', 'policies'];

export function getServiceSteps(copy = {}) {
  const optionsLabel = copy.kind === 'stay'
    ? 'Units'
    : copy.kind === 'rental'
      ? 'Vehicles'
      : 'Options';
  return [
    { id: 'basics', label: 'Basics', icon: 'info' },
    { id: 'details', label: 'Details', icon: 'sliders' },
    { id: 'options', label: optionsLabel, icon: 'layers' },
    { id: 'policies', label: 'Policies', icon: 'shield' },
  ];
}

export function stepIndexFromId(stepId) {
  const index = SERVICE_STEP_IDS.indexOf(stepId);
  return index >= 0 ? index : 0;
}

/**
 * Map review.missing keys / free-text issues to a workspace tab.
 */
export function mapIssueToStepId(issue = '') {
  const text = String(issue || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (!text) return 'basics';

  if (/(deposit|payment|cancel|rebook|policy|commission|refund)/.test(text)) return 'policies';
  if (/(option|price|unit|room|vehicle|inventory|capacity|base price)/.test(text)) return 'options';
  if (/(listing|check.?in|check.?out|rental|pickup|return|amenit|host|identity|driver|licence|license|cuisine|duration|seating|venue)/.test(text)) {
    return 'details';
  }
  return 'basics';
}

export function firstMissingStepId(missing = []) {
  const list = Array.isArray(missing) ? missing : [];
  if (!list.length) return null;
  return mapIssueToStepId(list[0]);
}

/**
 * Validate a single step only (not cumulative).
 * ctx: { form, options, domain, subtype, supportsOptions, copy, firstError, validateListingClient, validateInventoryClient }
 */
export function validateStepAt(stepIndex, ctx = {}) {
  const {
    form = {},
    options = [],
    domain,
    subtype,
    supportsOptions = true,
    copy = {},
    firstError,
    validateListingClient,
    validateInventoryClient,
  } = ctx;

  if (stepIndex === 0) {
    if (!form.categoryId) return 'Select a service category.';
    if (!String(form.title || '').trim()) return 'Title is required.';
    if (!form.location?.country || !(form.location?.city || form.location?.state)) {
      return 'Country and city are required. Search and select a place.';
    }
    if (form.status === 'available' && (!form.location?.latitudeRaw && !form.location?.latitude)) {
      return 'Drop a pin on the map before marking available.';
    }
    if (!form.contactDetails?.phoneE164) return 'Contact phone is required.';
    return '';
  }

  if (stepIndex === 1) {
    if (typeof firstError !== 'function' || typeof validateListingClient !== 'function') return '';
    return firstError(validateListingClient(domain, subtype, form.listingAttributes || {})) || '';
  }

  if (stepIndex === 2) {
    if (!supportsOptions) {
      const price = Number(form.basePrice);
      if (!Number.isFinite(price) || price < 0) return 'Base price (RWF) is required for this category.';
      return '';
    }
    const named = options.filter((option) => String(option.name || '').trim());
    if (!named.length) {
      if (copy.kind === 'stay') return 'Add at least one unit.';
      if (copy.kind === 'rental') return 'Add at least one vehicle / bike type with a name and price.';
      return 'Add at least one option.';
    }
    for (const option of named) {
      if (!Number.isFinite(Number(option.price)) || Number(option.price) < 0) {
        return `${option.name || 'Option'} needs a valid price.`;
      }
      if (typeof firstError === 'function' && typeof validateInventoryClient === 'function') {
        const inventoryError = firstError(validateInventoryClient(domain, option.attributes || {}, { subtype }));
        if (inventoryError) return inventoryError;
      }
    }
    return '';
  }

  if (stepIndex === 3) {
    const deposit = Number(form.paymentPolicy?.depositPercentage);
    if (!Number.isFinite(deposit) || deposit < 20 || deposit > 100) {
      return 'Online deposit must be between 20% and 100%.';
    }
    return '';
  }

  return '';
}

export function findFirstInvalidStep(ctx = {}) {
  for (let index = 0; index < SERVICE_STEP_IDS.length; index += 1) {
    const message = validateStepAt(index, ctx);
    if (message) return { message, stepIndex: index };
  }
  return { message: '', stepIndex: 0 };
}

/** Infer which edit step to open when availability toggle fails. */
export function inferStepFromAvailabilityGaps({ hasLocation, hasPriceRows }) {
  if (!hasLocation) return 0;
  if (!hasPriceRows) return 2;
  return 0;
}
