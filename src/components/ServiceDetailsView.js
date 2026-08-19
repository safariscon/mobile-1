import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import AvailabilityTable from './AvailabilityTable';
import ServiceLocationMap from './ServiceLocationMap';
import { formatMoney, serviceApprovalStatus } from '../lib/serviceMapper';
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

function OptionCard({ option, index }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionIndex}>Option {index + 1}</Text>
        <Text style={styles.optionName}>{option.name || option.optionName || `Option ${index + 1}`}</Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Price</Text>
        <Text style={styles.priceValue}>{option.priceText || formatMoney(option.price)}</Text>
        {option.priceType || option.cells?.priceType ? (
          <Text style={styles.priceMeta}>{option.priceType || option.cells?.priceType}</Text>
        ) : null}
      </View>
      {asList(option.pricingRules).length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Pricing rules</Text>
          {option.pricingRules.map((item) => (
            <DetailRow key={`${option.id}-${item.key}`} label={item.label} value={item.value} />
          ))}
        </View>
      ) : null}
      {asList(option.availabilityRules).length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Availability</Text>
          {option.availabilityRules.map((item) => (
            <DetailRow key={`${option.id}-${item.key}`} label={item.label} value={item.value} />
          ))}
        </View>
      ) : null}
      {option.details ? <Text style={styles.optionDetails}>{option.details}</Text> : null}
      {asList(option.amenities).length ? (
        <View style={styles.chipRow}>
          {option.amenities.map((item) => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  const options = asList(normalized.options?.length ? normalized.options : normalized.availabilityTable?.rows);
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
              <DetailRow label="Availability" value={normalized.availabilityText || normalized.inventoryStatusLabel || normalized.status} />
              <DetailRow label="Booking mode" value={normalized.bookingMode || 'manual'} />
              <DetailRow label="Price" value={normalized.priceText || formatMoney(normalized.pricing?.amount)} />
              <DetailRow label="Cancel window (hours)" value={normalized.cancelWindowHours || normalized.cancellationPolicy?.windowHours} />
              <DetailRow label="Cancel penalty (%)" value={normalized.cancelPenaltyPercent || normalized.cancellationPolicy?.penaltyPercent} />
              <DetailRow label={t('admin.descriptionLabel')} value={normalized.description} />
            </Section>

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

            <Section title="Options / prices">
              {options.length ? options.map((option, index) => (
                <OptionCard key={option.id || index} option={option} index={index} />
              )) : (
                <AvailabilityTable table={normalized.availabilityTable} emptyText={t('serviceDetails.emptyOptions')} />
              )}
            </Section>

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
