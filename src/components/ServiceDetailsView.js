import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import AvailabilityTable from './AvailabilityTable';
import ServiceLocationMap from './ServiceLocationMap';
import { formatMoney, serviceApprovalStatus } from '../lib/serviceMapper';
import { domainCopy, remainingPaymentLabel } from '../features/domain/registry';
import useThemedStyles from '../theme/useThemedStyles';

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function DetailRow({ label, value }) {
  const { styles } = useThemedStyles(createStyles);
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

function Section({ title, children }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function ServiceDetailsView({
  visible,
  service,
  loading = false,
  showProvider = false,
  showPrivateFields = false,
  title = 'Service details',
  onClose,
  footer,
}) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  if (!visible) return null;

  const normalized = service || {};
  const approvalStatus = serviceApprovalStatus(normalized);
  const images = asList(normalized.imageItems?.length ? normalized.imageItems : normalized.images?.map((url) => ({ url, alt: normalized.title || normalized.name })));
  const options = asList(normalized.options?.length ? normalized.options : (normalized.units?.length ? normalized.units : normalized.availabilityTable?.rows));
  const listing = normalized.listingAttributes || {};
  const copy = domainCopy(normalized);
  const identity = listing.hostIdentity || {};
  const plans = listing.ratePlans || {};
  const rooms = asList(normalized.rooms);
  const nestedServices = asList(normalized.nestedServices);
  const bookingFields = asList(normalized.bookingForm?.fields).filter((field) => field.enabled !== false);
  const location = normalized.location || normalized.map || {};

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton} activeOpacity={0.82}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{title}</Text>
          <View style={styles.iconSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>{t('serviceDetails.loading')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <StatusBadge status={approvalStatus} />

            <Section title="Listing">
              <DetailRow label={t('admin.name')} value={normalized.title || normalized.name} />
              <DetailRow label={t('admin.type')} value={normalized.category || normalized.serviceType} />
              <DetailRow label="Domain" value={[normalized.domain, normalized.subtype].filter(Boolean).join(' · ')} />
              <DetailRow label="Availability" value={normalized.availabilityText || normalized.inventoryStatusLabel || normalized.status} />
              <DetailRow label="Booking mode" value={normalized.bookingMode || 'manual'} />
              <DetailRow label="Price" value={normalized.priceText || formatMoney(normalized.pricing?.amount)} />
              <DetailRow label="Cancel window (hours)" value={normalized.cancelWindowHours || normalized.cancellationPolicy?.windowHours} />
              <DetailRow label="Cancel penalty (%)" value={normalized.cancelPenaltyPercent || normalized.cancellationPolicy?.penaltyPercent} />
              <DetailRow label="Platform commission (%)" value={normalized.platformCommissionPercent} />
              <DetailRow label={t('admin.descriptionLabel')} value={normalized.description} />
            </Section>

            {copy.kind === 'rental' ? (
              <Section title="Rental rules">
                <DetailRow label="Vehicle class" value={listing.vehicleClass} />
                <DetailRow label="Transmission" value={listing.transmission} />
                <DetailRow label="Fuel type" value={listing.fuelType} />
                <DetailRow label="Fuel policy" value={listing.fuelPolicy} />
                <DetailRow label="Minimum driver age" value={listing.minimumDriverAge} />
                <DetailRow label="Pickup from" value={listing.pickupTime} />
                <DetailRow label="Return by" value={listing.returnTime} />
                <DetailRow label="Minimum rental" value={listing.minRentalDays ? `${listing.minRentalDays} day${Number(listing.minRentalDays) === 1 ? '' : 's'}` : ''} />
                <DetailRow label="Maximum rental" value={listing.maxRentalDays ? `${listing.maxRentalDays} days` : ''} />
                <DetailRow label="With driver" value={listing.withDriver == null ? '' : listing.withDriver ? 'Yes' : 'No'} />
                <DetailRow label="Insurance included" value={listing.insuranceIncluded == null ? '' : listing.insuranceIncluded ? 'Yes' : 'No'} />
                <DetailRow label="Deposit note" value={listing.depositNote} />
              </Section>
            ) : copy.kind === 'stay' && Object.keys(listing).length ? (
              <Section title="Property details">
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
              </Section>
            ) : null}

            {(identity.legalName || identity.companyName || identity.idNumber) ? (
              <Section title="Host identity">
                <DetailRow label="Legal name" value={identity.legalName} />
                <DetailRow label="Host type" value={identity.isCompany ? 'Company' : 'Individual'} />
                <DetailRow label="Company name" value={identity.companyName} />
                <DetailRow label="ID type" value={humanize(identity.idType)} />
                <DetailRow label={showPrivateFields ? 'ID / registration number' : 'Identity document on file'} value={showPrivateFields ? identity.idNumber : (identity.idNumber || identity.hasIdentityDocument ? 'Yes' : 'No')} />
                <DetailRow label="Billing address" value={identity.billingSameAsProperty === false ? identity.billingAddress : 'Same as property'} />
              </Section>
            ) : null}

            {(normalized.paymentPolicy || normalized.cancellationPolicy?.type) ? (
              <Section title="Payment and cancellation">
                <DetailRow label="Deposit" value={normalized.paymentPolicy?.depositPercentage != null ? `${normalized.paymentPolicy.depositPercentage}%` : ''} />
                <DetailRow label="Remaining payment" value={remainingPaymentLabel(normalized.paymentPolicy?.remainingPaymentMethod, normalized)} />
                <DetailRow label="Cancellation type" value={normalized.cancellationPolicy?.type} />
                <DetailRow label="Free cancellation (hours)" value={normalized.cancellationPolicy?.freeCancellationUntilHours} />
              </Section>
            ) : null}

            <Section title="Images">
              {images.length ? (
                <View style={styles.imageGrid}>
                  {images.slice(0, 6).map((image, index) => (
                    <Image key={`${image.url}-${index}`} source={{ uri: image.url }} style={styles.imageTile} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No images uploaded yet.</Text>
              )}
            </Section>

            <Section title={t('admin.location')}>
              <DetailRow label="District / area" value={normalized.generalLocation} />
              <ServiceLocationMap
                latitude={location.latitude ?? normalized.map?.latitude}
                longitude={location.longitude ?? normalized.map?.longitude}
                formattedAddress={location.formattedAddress || normalized.map?.formattedAddress}
                googleMapsUrl={location.googleMapsUrl || normalized.map?.googleMapsUrl}
                osmUrl={location.osmUrl || normalized.map?.osmUrl}
              />
            </Section>

            {showProvider ? (
              <Section title="Service provider">
                <DetailRow label="Name" value={normalized.provider?.name || normalized.providerName} />
                <DetailRow label="Email" value={normalized.provider?.email} />
                <DetailRow label="Phone" value={normalized.provider?.phone || normalized.contactDetails?.phone} />
                <DetailRow label="Seller ID" value={normalized.provider?.sellerId || normalized.sellerId} />
              </Section>
            ) : null}

            {normalized.availability ? (
              <Section title="Listing availability">
                <AvailabilityBlock availability={normalized.availability} />
              </Section>
            ) : null}

            <Section title={copy.kind === 'stay' ? 'Rooms / units' : copy.kind === 'rental' ? 'Vehicle types' : 'Options / prices'}>
              {options.length ? options.map((option, index) => (
                <OptionCard key={option.id || index} option={option} index={index} />
              )) : (
                <AvailabilityTable table={normalized.availabilityTable} emptyText={t('serviceDetails.emptyOptions')} />
              )}
            </Section>

            {copy.kind === 'stay' && rooms.length ? (
              <Section title="Physical rooms">
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
              </Section>
            ) : null}

            {nestedServices.length ? (
              <Section title="Nested packages">
                {nestedServices.map((item) => (
                  <View key={item.id || item._id} style={styles.optionCard}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    <DetailRow label="Category" value={item.category} />
                    <DetailRow label="Price" value={item.price ? formatMoney(item.price) : ''} />
                    <DetailRow label="Details" value={item.description} />
                  </View>
                ))}
              </Section>
            ) : null}

            <Section title="Booking form fields">
              {bookingFields.length ? bookingFields.map((field) => (
                <View key={field.id} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldMeta}>
                    {field.type}{field.required ? ' · required' : ''}
                  </Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>No custom booking fields configured.</Text>
              )}
            </Section>

            {asList(normalized.amenities).length ? (
              <Section title={t('serviceDetails.amenities')}>
                <View style={styles.chipRow}>
                  {normalized.amenities.map((item) => (
                    <View key={item} style={styles.chip}>
                      <Feather name="check" size={12} color={colors.primary} />
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
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
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  loadingWrap: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgesuccess: { backgroundColor: colors.successSurface },
  statusBadgedanger: { backgroundColor: colors.dangerSurface },
  statusBadgewarning: { backgroundColor: colors.warningSurface },
  statusBadgeText: { fontSize: 12, fontWeight: '900' },
  statusBadgeTextsuccess: { color: colors.success },
  statusBadgeTextdanger: { color: colors.danger },
  statusBadgeTextwarning: { color: colors.warning },
  section: { marginTop: 18 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  detailRow: { marginBottom: 8 },
  detailLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 2 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageTile: { borderRadius: 8, height: 112, width: '31%' },
  optionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  optionHeader: { marginBottom: 10 },
  optionIndex: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  optionName: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 },
  priceBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginBottom: 10,
    padding: 10,
  },
  priceLabel: { color: colors.primaryDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  priceValue: { color: colors.primaryDark, fontSize: 16, fontWeight: '900', marginTop: 2 },
  priceMeta: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', marginTop: 2 },
  group: { marginTop: 8 },
  groupTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  optionDetails: { color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 8, opacity: 0.82 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  fieldMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 18 },
});
