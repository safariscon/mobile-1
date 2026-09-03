import { ActivityIndicator, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import AvailabilityTable from './AvailabilityTable';
import ServiceLocationMap from './ServiceLocationMap';
import ServiceStepTabs from './ServiceStepTabs';
import { useToast } from './Toast';
import { formatMoney, resolveServiceLocation, serviceApprovalStatus } from '../lib/serviceMapper';
import { domainCopy, remainingPaymentLabel } from '../features/domain/registry';
import { resolveRentalLocations } from '../lib/rentalLocations';
import { firstMissingStepId, getServiceSteps, mapIssueToStepId, stepIndexFromId } from '../lib/serviceSteps';
import useThemedStyles from '../theme/useThemedStyles';

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function joinAddressParts(...parts) {
  return parts.filter(Boolean).join(', ');
}

export function DetailRow({ label, value }) {
  const { styles } = useThemedStyles(createStyles);
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

export function DetailSection({ title, icon, children }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const kids = asList(Array.isArray(children) ? children : [children]).filter(Boolean);
  if (!kids.length) return null;
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        {icon ? (
          <View style={styles.sectionIcon}>
            <Feather name={icon} size={14} color={colors.primary} />
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StatusBadge({ status }) {
  const { styles } = useThemedStyles(createStyles);
  const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';
  const label = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending review';
  return (
    <View style={[styles.statusBadge, styles[`statusBadge${tone}`]]}>
      <Text style={[styles.statusBadgeText, styles[`statusBadgeText${tone}`]]}>{label}</Text>
    </View>
  );
}

function ChipRow({ items }) {
  const { styles } = useThemedStyles(createStyles);
  const list = asList(items);
  if (!list.length) return null;
  return (
    <View style={styles.chipRow}>
      {list.map((item) => (
        <View key={String(item)} style={styles.chip}>
          <Text style={styles.chipText}>{humanize(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function AvailabilityBlock({ availability, option }) {
  const source = availability || {};
  const from = source.windowStartDate || option?.availableFrom;
  const to = source.windowEndDate || option?.availableTo;
  const days = source.daysOfWeek?.length ? source.daysOfWeek : option?.availableDays;
  if (!source.isAnytime && !from && !to && !asList(days).length && !source.capacityTotal) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <DetailRow label="Anytime" value={source.isAnytime ? 'Yes' : ''} />
      <DetailRow label="Available from" value={from} />
      <DetailRow label="Available until" value={to} />
      <DetailRow label="Days" value={asList(days).map(humanize).join(', ')} />
      <DetailRow label="Start time" value={source.dayStartTime || option?.availableStartTime} />
      <DetailRow label="End time" value={source.dayEndTime || option?.availableEndTime} />
      <DetailRow label="Total capacity" value={source.capacityTotal} />
      <DetailRow label="Remaining" value={source.capacityRemaining} />
    </View>
  );
}

function OptionCard({ option, index }) {
  const { styles } = useThemedStyles(createStyles);
  const attributes = option.attributes || option.cells?.attributes || {};
  const beds = asList(attributes.beds).filter((bed) => bed?.type && Number(bed.count) > 0);
  const perGuest = attributes.pricingMode === 'per_guest';
  return (
    <View style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionIndex}>Option {index + 1}</Text>
        <Text style={styles.optionName}>{option.name || attributes.unitName || option.optionName || `Option ${index + 1}`}</Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Price</Text>
        <Text style={styles.priceValue}>{option.priceText || formatMoney(option.price)}</Text>
        {option.priceType || option.pricingType || option.cells?.priceType ? (
          <Text style={styles.priceMeta}>{option.priceType || option.pricingType || option.cells?.priceType}</Text>
        ) : null}
      </View>
      {attributes.maxGuests || attributes.bedrooms || attributes.unitType ? (
        <>
          <DetailRow label="Unit type" value={humanize(attributes.unitType)} />
          <DetailRow label="Max guests" value={attributes.maxGuests} />
          <DetailRow label="Bedrooms" value={attributes.bedrooms} />
          <DetailRow label="Private bathroom" value={attributes.bathroomPrivate === false ? 'No' : attributes.bathroomPrivate ? 'Yes' : ''} />
        </>
      ) : null}
      <DetailRow label={attributes.quantity ? 'Number of this type' : 'Quantity'} value={attributes.quantity || option.capacity || option.maximumCapacity} />
      {beds.length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Beds</Text>
          <ChipRow items={beds.map((bed) => `${bed.count} × ${humanize(bed.type)}`)} />
        </View>
      ) : null}
      {attributes.maxGuests || attributes.bedrooms || attributes.unitType ? (
        <DetailRow
          label="How price is charged"
          value={perGuest ? 'Per guest per night. 2 guests pay 2 × this price.' : 'Whole unit per night. Guest count is capacity, not a second price.'}
        />
      ) : null}
      {asList(attributes.roomAmenities).length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Room amenities</Text>
          <ChipRow items={attributes.roomAmenities} />
        </View>
      ) : null}
      {asList(attributes.bathroomAmenities).length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Bathroom amenities</Text>
          <ChipRow items={attributes.bathroomAmenities} />
        </View>
      ) : null}
      {asList(option.pricingRules).length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Pricing rules</Text>
          {option.pricingRules.map((item) => (
            <DetailRow key={`${option.id}-${item.key}`} label={item.label} value={item.value} />
          ))}
        </View>
      ) : null}
      <AvailabilityBlock availability={option.availability} option={option} />
      {option.details ? <Text style={styles.optionDetails}>{option.details}</Text> : null}
      {asList(option.amenities).length ? <ChipRow items={option.amenities} /> : null}
      {asList(option.extraCells).map((item) => (
        <DetailRow key={`${option.id}-${item.key}`} label={item.label} value={item.value} />
      ))}
    </View>
  );
}

export function ServiceDetailsBody({
  service,
  showProvider = false,
  showPrivateFields = false,
  footer,
  activeStepId = null,
  hideHero = false,
}) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const normalized = service || {};
  const approvalStatus = serviceApprovalStatus(normalized);
  const images = asList(
    normalized.imageItems?.length
      ? normalized.imageItems
      : normalized.images?.map((url) => (typeof url === 'string' ? { url, alt: normalized.title || normalized.name } : url))
  );
  const options = asList(
    normalized.options?.length
      ? normalized.options
      : (normalized.units?.length ? normalized.units : normalized.availabilityTable?.rows)
  );
  const listing = normalized.listingAttributes || {};
  const copy = domainCopy(normalized);
  const identity = listing.hostIdentity || {};
  const plans = listing.ratePlans || {};
  const rooms = asList(normalized.rooms);
  const nestedServices = asList(normalized.nestedServices);
  const bookingFields = asList(normalized.bookingForm?.fields).filter((field) => field.enabled !== false);
  const location = resolveServiceLocation(normalized);
  const contact = normalized.contactDetails || {};
  const provider = normalized.provider || {};
  const payout = provider.payoutDetails || normalized.payoutDetails || {};
  const missing = asList(normalized.review?.missing);
  const rentalLocations = copy.kind === 'rental' ? resolveRentalLocations(normalized) : null;
  const show = (stepId) => !activeStepId || activeStepId === stepId;

  const openMaps = () => {
    const url = location.googleMapsUrl || (location.latitude != null
      ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
      : '');
    if (url) Linking.openURL(url).catch(() => {});
  };

  const stepMissing = activeStepId
    ? missing.filter((item) => mapIssueToStepId(item) === activeStepId)
    : missing;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!hideHero ? (
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <StatusBadge status={approvalStatus} />
            {normalized.domain || normalized.subtype ? (
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{[normalized.domain, normalized.subtype].filter(Boolean).join(' · ')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{normalized.title || normalized.name || 'Service'}</Text>
          <Text style={styles.heroSubtitle}>
            {[normalized.category || normalized.serviceType, location.district || location.province].filter(Boolean).join(' · ')}
          </Text>
          {normalized.description && show('basics') ? <Text style={styles.heroDescription}>{normalized.description}</Text> : null}
        </View>
      ) : null}

      {stepMissing.length ? (
        <View style={styles.warningCard}>
          <Feather name="alert-triangle" size={16} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Needs attention on this tab</Text>
            <Text style={styles.warningText}>{stepMissing.map(humanize).join(', ')}</Text>
          </View>
        </View>
      ) : null}

      {show('basics') ? (
        <>
          <DetailSection title="Listing overview" icon="file-text">
            <View style={styles.grid}>
              <DetailRow label="Service name" value={normalized.title || normalized.name} />
              <DetailRow label="Category" value={normalized.category || normalized.serviceType} />
              <DetailRow label="Domain" value={[normalized.domain, normalized.subtype].filter(Boolean).join(' · ')} />
              <DetailRow label="Availability" value={normalized.availabilityText || normalized.inventoryStatusLabel || normalized.status} />
              <DetailRow label="Booking mode" value={humanize(normalized.bookingMode || 'manual')} />
              <DetailRow label="Price" value={normalized.priceText || formatMoney(normalized.pricing?.amount || normalized.basePrice)} />
              <DetailRow label="Quantity remaining" value={normalized.availableQuantity ?? normalized.quantityRemaining} />
              <DetailRow label="Registered" value={formatDateTime(normalized.createdAt)} />
              <DetailRow label="Last updated" value={formatDateTime(normalized.updatedAt)} />
            </View>
          </DetailSection>

          <DetailSection title="Photos" icon="image">
            {images.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageStrip}>
                {images.map((image, index) => (
                  <Image key={`${image.url}-${index}`} source={{ uri: image.url }} style={styles.imageTile} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No images uploaded yet.</Text>
            )}
          </DetailSection>

          <DetailSection title="Location" icon="map-pin">
            <DetailRow label="Full address" value={location.formattedAddress} />
            <DetailRow label="Country" value={location.country} />
            <DetailRow label="Province" value={location.province || location.state} />
            <DetailRow label="District" value={location.district || location.city} />
            <DetailRow label="Sector" value={location.sector} />
            <DetailRow label="Cell" value={location.cell} />
            <DetailRow label="Village" value={location.village} />
            <DetailRow label="Coordinates" value={location.latitude != null && location.longitude != null ? `${location.latitude}, ${location.longitude}` : ''} />
            <DetailRow label="Exact pin verified" value={location.isExactLocationVerified ? 'Yes' : location.latitude != null ? 'Coordinates present' : ''} />
            <DetailRow label="Place ID" value={showPrivateFields ? location.placeId : ''} />
            <ServiceLocationMap
              latitude={location.latitude}
              longitude={location.longitude}
              formattedAddress={location.formattedAddress || joinAddressParts(location.village, location.cell, location.sector, location.district, location.province)}
              googleMapsUrl={location.googleMapsUrl}
              osmUrl={location.osmUrl}
            />
            {location.latitude != null ? (
              <TouchableOpacity style={styles.mapAction} onPress={openMaps} activeOpacity={0.84}>
                <Feather name="external-link" size={14} color={colors.primary} />
                <Text style={styles.mapActionText}>Open exact pin in Google Maps</Text>
              </TouchableOpacity>
            ) : null}
          </DetailSection>

          <DetailSection title="Contact details" icon="phone">
            <DetailRow label="Public contact" value={normalized.contactInfo} />
            <DetailRow label="Phone" value={contact.phoneE164 || contact.phone} />
            <DetailRow label="WhatsApp" value={contact.whatsappE164 || contact.whatsapp} />
            <DetailRow label="Email" value={contact.email} />
            <DetailRow label="Exact address note" value={contact.exactAddress} />
          </DetailSection>

          {showProvider ? (
            <DetailSection title="Service provider" icon="user">
              <DetailRow label="Name" value={provider.name || normalized.providerName} />
              <DetailRow label="Email" value={provider.email || normalized.providerEmail} />
              <DetailRow label="Phone" value={provider.phone || normalized.providerPhone || contact.phoneE164 || contact.phone} />
              <DetailRow label="Seller ID" value={provider.sellerId || normalized.sellerId} />
              <DetailRow label="Role" value={humanize(provider.role)} />
              <DetailRow label="Email verified" value={provider.emailVerified == null ? '' : provider.emailVerified ? 'Yes' : 'No'} />
              <DetailRow label="Provider since" value={formatDateTime(provider.createdAt)} />
              {showPrivateFields && (payout.method || payout.accountName || payout.msisdn) ? (
                <>
                  <Text style={[styles.groupTitle, { marginTop: 8 }]}>Payout account</Text>
                  <DetailRow label="Method" value={humanize(payout.method)} />
                  <DetailRow label="Provider" value={payout.providerName || payout.providerId} />
                  <DetailRow label="Account name" value={payout.accountName} />
                  <DetailRow label="Account / MoMo" value={payout.msisdn || payout.accountNumber} />
                  <DetailRow label="Verified" value={payout.verified == null ? '' : payout.verified ? 'Yes' : 'No'} />
                </>
              ) : null}
            </DetailSection>
          ) : null}
        </>
      ) : null}

      {show('details') ? (
        <>
          {copy.kind === 'rental' ? (
            <DetailSection title="Rental / vehicle details" icon="truck">
              <DetailRow label="Pickup location" value={rentalLocations?.pickupLocation} />
              <DetailRow label="Return location" value={rentalLocations?.returnLocation} />
              <DetailRow label="Vehicle class" value={listing.vehicleClass} />
              <DetailRow label="Transmission" value={listing.transmission} />
              <DetailRow label="Fuel type" value={listing.fuelType} />
              <DetailRow label="Fuel policy" value={listing.fuelPolicy} />
              <DetailRow label="Minimum driver age" value={listing.minimumDriverAge} />
              <DetailRow label="Pickup from" value={listing.pickupTime} />
              <DetailRow label="Return by" value={listing.returnTime} />
              <DetailRow label="Minimum rental" value={listing.minRentalDays ? `${listing.minRentalDays} day(s)` : ''} />
              <DetailRow label="Maximum rental" value={listing.maxRentalDays ? `${listing.maxRentalDays} days` : ''} />
              <DetailRow label="With driver" value={listing.withDriver == null ? '' : listing.withDriver ? 'Yes' : 'No'} />
              <DetailRow label="Insurance included" value={listing.insuranceIncluded == null ? '' : listing.insuranceIncluded ? 'Yes' : 'No'} />
              <DetailRow label="Deposit note" value={listing.depositNote} />
            </DetailSection>
          ) : null}

          {copy.kind === 'stay' && Object.keys(listing).length ? (
            <DetailSection title="Property details" icon="home">
              <DetailRow label="Property type" value={humanize(listing.propertyKind)} />
              <DetailRow label="Star rating" value={humanize(listing.starRating)} />
              <DetailRow label="Listing scale" value={humanize(listing.listingScale)} />
              <DetailRow label="Check-in" value={[listing.checkInFrom || listing.checkInTime, listing.checkInUntil].filter(Boolean).join(' – ')} />
              <DetailRow label="Check-out" value={[listing.checkOutFrom, listing.checkOutUntil || listing.checkOutTime].filter(Boolean).join(' – ')} />
              <DetailRow label="Allows children" value={humanize(listing.allowsChildren)} />
              <DetailRow label="Allows pets" value={humanize(listing.allowsPets)} />
              <DetailRow label="First check-in" value={listing.firstCheckInMode === 'date' ? listing.firstCheckInDate : humanize(listing.firstCheckInMode)} />
              <DetailRow label="Booking horizon (days)" value={listing.availabilityHorizonDays} />
              <DetailRow label="Long stays" value={listing.allowLongStays ? `Up to ${listing.maxStayNights || 90} nights` : 'Maximum 30 nights'} />
              <DetailRow label="Calendar import URL" value={listing.calendarImportUrl} />
              <DetailRow label="Non-refundable" value={plans.nonRefundable?.enabled ? `${plans.nonRefundable.discountPercent}% off` : ''} />
              <DetailRow label="Weekly rate" value={plans.weekly?.enabled ? `${plans.weekly.discountPercent}% off, min ${plans.weekly.minNights} nights` : ''} />
              {asList(listing.amenities).length ? (
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>Property amenities</Text>
                  <ChipRow items={listing.amenities} />
                </View>
              ) : null}
            </DetailSection>
          ) : null}

          {(identity.legalName || identity.companyName || identity.idNumber) ? (
            <DetailSection title="Host identity" icon="shield">
              <DetailRow label="Legal name" value={identity.legalName} />
              <DetailRow label="Host type" value={identity.isCompany ? 'Company' : 'Individual'} />
              <DetailRow label="Company name" value={identity.companyName} />
              <DetailRow label="ID type" value={humanize(identity.idType)} />
              <DetailRow
                label={showPrivateFields ? 'ID / registration number' : 'Identity document on file'}
                value={showPrivateFields ? identity.idNumber : (identity.idNumber || identity.hasIdentityDocument ? 'Yes' : 'No')}
              />
              <DetailRow label="Billing address" value={identity.billingSameAsProperty === false ? identity.billingAddress : 'Same as property'} />
            </DetailSection>
          ) : null}

          <DetailSection title="Booking form fields" icon="edit-3">
            {bookingFields.length ? bookingFields.map((field) => (
              <View key={field.id || field.key || field.label} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldMeta}>
                  {field.type}{field.required ? ' · required' : ''}
                </Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>No custom booking fields configured.</Text>
            )}
          </DetailSection>

          {asList(normalized.amenities).length ? (
            <DetailSection title={t('serviceDetails.amenities')} icon="check-circle">
              <ChipRow items={normalized.amenities} />
            </DetailSection>
          ) : null}
        </>
      ) : null}

      {show('options') ? (
        <>
          {normalized.availability ? (
            <DetailSection title="Listing availability" icon="calendar">
              <AvailabilityBlock availability={normalized.availability} />
            </DetailSection>
          ) : null}

          <DetailSection
            title={copy.kind === 'stay' ? 'Rooms / units' : copy.kind === 'rental' ? 'Vehicle types' : 'Options / prices'}
            icon="layers"
          >
            {options.length ? options.map((option, index) => (
              <OptionCard key={option.id || index} option={option} index={index} />
            )) : (
              <AvailabilityTable table={normalized.availabilityTable} emptyText={t('serviceDetails.emptyOptions')} />
            )}
          </DetailSection>

          {copy.kind === 'stay' && rooms.length ? (
            <DetailSection title="Physical rooms" icon="key">
              {rooms.map((room) => (
                <View key={room.id || room._id || room.roomNumber} style={styles.optionCard}>
                  <Text style={styles.optionName}>{room.roomNumber || room.type || 'Room'}</Text>
                  <DetailRow label="Type" value={room.roomType || room.type} />
                  <DetailRow label="Price" value={room.pricePerNight || room.price ? formatMoney(room.pricePerNight || room.price) : ''} />
                  <DetailRow label="Adults" value={room.capacity?.adults} />
                  <DetailRow label="Children" value={room.capacity?.children} />
                  <ChipRow items={room.amenities} />
                </View>
              ))}
            </DetailSection>
          ) : null}

          {nestedServices.length ? (
            <DetailSection title="Nested packages" icon="package">
              {nestedServices.map((item) => (
                <View key={item.id || item._id} style={styles.optionCard}>
                  <Text style={styles.optionName}>{item.name}</Text>
                  <DetailRow label="Category" value={item.category} />
                  <DetailRow label="Price" value={item.price ? formatMoney(item.price) : ''} />
                  <DetailRow label="Details" value={item.description} />
                </View>
              ))}
            </DetailSection>
          ) : null}
        </>
      ) : null}

      {show('policies') ? (
        <>
          <DetailSection title="Payment & cancellation" icon="credit-card">
            <DetailRow label="Online deposit" value={normalized.paymentPolicy?.depositPercentage != null ? `${normalized.paymentPolicy.depositPercentage}%` : ''} />
            <DetailRow label="Remaining payment" value={remainingPaymentLabel(normalized.paymentPolicy?.remainingPaymentMethod, normalized)} />
            <DetailRow label="Cancellation type" value={humanize(normalized.cancellationPolicy?.type)} />
            <DetailRow label="Free cancellation (hours)" value={normalized.cancellationPolicy?.freeCancellationUntilHours} />
            <DetailRow label="Cancel window (hours)" value={normalized.cancelWindowHours || normalized.cancellationPolicy?.windowHours} />
            <DetailRow label="Cancel penalty (%)" value={normalized.cancelPenaltyPercent ?? normalized.cancellationPolicy?.penaltyPercent} />
            <DetailRow label="Platform commission (%)" value={normalized.platformCommissionPercent ?? normalized.commissionPercentage} />
            <DetailRow label="Rebook request deadline (hours)" value={normalized.rebookSettings?.requestDeadlineHours} />
            <DetailRow label="Rebook ID validity (hours)" value={normalized.rebookSettings?.rebookIdValidityHours} />
          </DetailSection>

          {normalized.promotion?.enabled ? (
            <DetailSection title="Promotion" icon="tag">
              <DetailRow label="Title" value={normalized.promotion.title || normalized.promotion.label} />
              <DetailRow label="Discount" value={normalized.promotion.discountPercent != null ? `${normalized.promotion.discountPercent}%` : normalized.promotion.discountText} />
              <DetailRow label="Starts" value={formatDateTime(normalized.promotion.startsAt || normalized.promotion.startAt)} />
              <DetailRow label="Ends" value={formatDateTime(normalized.promotion.endsAt || normalized.promotion.endAt)} />
            </DetailSection>
          ) : null}
        </>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  );
}

export default function ServiceDetailsView({
  visible,
  service,
  loading = false,
  showProvider = false,
  showPrivateFields = false,
  title = 'Service details',
  presentation = 'modal',
  initialStepId = null,
  onClose,
  onBack,
  onEditStep,
  footer,
}) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const { showToast, toastNode } = useToast();
  const isPage = presentation === 'page';
  const copy = domainCopy(service || {});
  const steps = useMemo(() => getServiceSteps(copy), [copy.kind]);
  const missing = asList(service?.review?.missing);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!service) return;
    const fromProp = initialStepId || firstMissingStepId(missing);
    if (fromProp) {
      const nextIndex = stepIndexFromId(fromProp);
      setStepIndex(nextIndex);
      if (missing.length) {
        showToast(`Review ${steps[nextIndex]?.label || 'this'} tab: ${humanize(missing[0])}`, 'warning');
      }
    } else {
      setStepIndex(0);
    }
  // Only re-route when the service identity / missing list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?._id || service?.id, missing.join('|'), initialStepId]);

  if (!isPage && !visible) return null;

  const activeStepId = steps[stepIndex]?.id || 'basics';

  const header = (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack || onClose} style={styles.iconButton} activeOpacity={0.82}>
        <Feather name={isPage ? 'arrow-left' : 'x'} size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.topCopy}>
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        {isPage ? (
          <Text style={styles.topSubtitle} numberOfLines={1}>
            {service?.title || service?.name || 'Full listing review'} · {steps[stepIndex]?.label}
          </Text>
        ) : null}
      </View>
      <View style={styles.iconSpacer} />
    </View>
  );

  const tabs = !loading ? (
    <View style={styles.tabsPad}>
      <ServiceStepTabs
        steps={steps}
        activeIndex={stepIndex}
        onChange={setStepIndex}
        mode="view"
      />
    </View>
  ) : null;

  const body = loading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>{t('serviceDetails.loading')}</Text>
    </View>
  ) : (
    <ServiceDetailsBody
      service={service}
      showProvider={showProvider}
      showPrivateFields={showPrivateFields}
      activeStepId={activeStepId}
      hideHero={false}
      footer={footer || (onEditStep ? (
        <TouchableOpacity
          style={styles.editTabButton}
          onPress={() => onEditStep(stepIndex, activeStepId)}
          activeOpacity={0.86}
        >
          <Feather name="edit-2" size={14} color={colors.white} />
          <Text style={styles.editTabButtonText}>Edit {steps[stepIndex]?.label || 'this'} step</Text>
        </TouchableOpacity>
      ) : null)}
    />
  );

  const chrome = (
    <View style={styles.screen}>
      {toastNode}
      {header}
      {tabs}
      {body}
    </View>
  );

  if (isPage) return chrome;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {chrome}
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  tabsPad: { paddingHorizontal: 14, paddingTop: 4 },
  editTabButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  editTabButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconSpacer: { width: 36 },
  topCopy: { flex: 1, minWidth: 0 },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  topSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  loadingWrap: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  content: { padding: 14, paddingBottom: 36 },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  badgeRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  statusBadgesuccess: { backgroundColor: colors.successSurface },
  statusBadgedanger: { backgroundColor: colors.dangerSurface },
  statusBadgewarning: { backgroundColor: colors.warningSurface },
  statusBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  statusBadgeTextsuccess: { color: colors.success },
  statusBadgeTextdanger: { color: colors.danger },
  statusBadgeTextwarning: { color: colors.warning },
  metaBadge: { backgroundColor: colors.surfaceMuted || colors.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  metaBadgeText: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  heroTitle: { color: colors.textStrong || colors.text, fontSize: 22, fontWeight: '900' },
  heroSubtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  heroDescription: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: 10 },
  warningCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    padding: 12,
  },
  warningTitle: { color: colors.warning, fontSize: 13, fontWeight: '900' },
  warningText: { color: colors.warning, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  sectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  sectionTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '900' },
  grid: { gap: 2 },
  detailRow: { marginBottom: 10 },
  detailLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 3 },
  imageStrip: { gap: 8, paddingRight: 8 },
  imageTile: { backgroundColor: colors.border, borderRadius: 12, height: 140, width: 180 },
  optionCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  optionHeader: { marginBottom: 10 },
  optionIndex: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  optionName: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 },
  priceBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
  },
  priceLabel: { color: colors.primaryDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  priceValue: { color: colors.primaryDark, fontSize: 16, fontWeight: '900', marginTop: 2 },
  priceMeta: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', marginTop: 2 },
  group: { marginTop: 8 },
  groupTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 6 },
  optionDetails: { color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 8, opacity: 0.82 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  fieldRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  fieldMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  mapAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
  },
  mapActionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  footer: { marginTop: 8 },
});
