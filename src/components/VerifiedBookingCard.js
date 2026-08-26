import { Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';
import { bookingQrImageUrl, formatRwf, verificationShareText } from '../lib/bookingVerification';

let colors = lightColors;
let styles;

function Row({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function VerifiedBookingCard({
  booking,
  onComplete,
  completing = false,
  showComplete = false,
  showQr = false,
}) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  if (!booking) return null;

  const paid = Boolean(booking.paid || ['deposit_paid', 'deposit-paid', 'paid', 'completed'].includes(String(booking.paymentStatus || '').toLowerCase()));
  const dates = [booking.checkIn, booking.checkOut].filter(Boolean).join(' → ')
    || (booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : '');

  const share = () => {
    Share.share({ message: verificationShareText(booking) }).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.badge, paid ? styles.badgePaid : styles.badgeUnpaid]}>
          <Text style={[styles.badgeText, paid ? styles.badgePaidText : styles.badgeUnpaidText]}>
            {paid ? t('verify.paid') : t('verify.unpaid')}
          </Text>
        </View>
        <TouchableOpacity onPress={share} hitSlop={10} activeOpacity={0.8}>
          <Feather name="share-2" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.code}>{booking.bookingCode || booking.bookingId || booking._id}</Text>
      <Row label={t('seller.client')} value={booking.customerName || booking.touristId?.name} />
      <Row label={t('bookingForm.email')} value={booking.customerEmail || booking.touristId?.email} />
      <Row label={t('bookingForm.phone')} value={booking.customerPhone || booking.touristId?.phone} />
      <Row label={t('serviceDetails.service')} value={booking.serviceName || booking.businessName} />
      <Row label={t('seller.dates')} value={dates} />
      <Row label="Guests" value={booking.guests || booking.quantity ? String(booking.guests || booking.quantity) : ''} />
      <Row label={t('customerBookings.amountPaid')} value={formatRwf(booking.amountPaid || booking.depositAmount || 0)} />
      <Row label={t('verify.remaining')} value={Number(booking.remainingAmount) > 0 ? formatRwf(booking.remainingAmount) : ''} />
      <Row label={t('admin.status')} value={String(booking.bookingStatus || booking.status || '').replace(/-/g, ' ')} />

      {showQr && booking.verificationToken ? (
        <Image source={{ uri: bookingQrImageUrl(booking.verificationToken) }} style={styles.qr} />
      ) : null}

      {showComplete && paid && !booking.bookingCodeUsed ? (
        <TouchableOpacity style={styles.complete} onPress={onComplete} disabled={completing} activeOpacity={0.86}>
          <Feather name="check-circle" size={18} color={colors.white} />
          <Text style={styles.completeText}>{t('seller.completeCheckIn')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    marginTop: 4,
    padding: 12,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgePaid: { backgroundColor: colors.successSurface },
  badgeUnpaid: { backgroundColor: colors.warningSurface },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  badgePaidText: { color: colors.success },
  badgeUnpaidText: { color: colors.warning },
  code: { color: colors.text, fontFamily: 'monospace', fontSize: 16, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  label: { color: colors.muted, flex: 1, fontSize: 12, fontWeight: '700' },
  value: { color: colors.text, flex: 1.4, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  qr: { alignSelf: 'center', backgroundColor: colors.white, borderRadius: 8, height: 96, marginTop: 4, width: 96 },
  complete: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 6,
  },
  completeText: { color: colors.white, fontSize: 14, fontWeight: '900' },
});
