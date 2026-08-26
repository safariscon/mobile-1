import { Image, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';
import { bookingQrImageUrl, bookingReceiptUrl, formatRwf, verificationShareText } from '../lib/bookingVerification';

let colors = lightColors;
let styles;

export default function BookingPassCard({ booking }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const token = booking?.verificationToken;
  if (!token) return null;

  const code = booking.bookingCode || booking._id;
  const dates = [booking.checkIn, booking.checkOut].filter(Boolean).join(' → ')
    || (booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : '');
  const guest = booking.bookingDetails?.fullName || booking.touristId?.name || booking.customerName;
  const share = () => {
    Share.share({ message: verificationShareText(booking) }).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('customerBookings.passTitle')}</Text>
      <Image source={{ uri: bookingQrImageUrl(token) }} style={styles.qr} />
      <Text style={styles.code}>{code}</Text>
      {guest ? <Text style={styles.meta}>{guest}</Text> : null}
      {dates ? <Text style={styles.meta}>{dates}</Text> : null}
      <Text style={styles.paid}>{formatRwf(booking.amountPaid || booking.depositAmount || 0)} paid</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={share} activeOpacity={0.84}>
          <Feather name="share-2" size={16} color={colors.primary} />
          <Text style={styles.actionText}>{t('actions.share')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.action}
          onPress={() => Linking.openURL(bookingReceiptUrl(token)).catch(() => {})}
          activeOpacity={0.84}
        >
          <Feather name="file-text" size={16} color={colors.primary} />
          <Text style={styles.actionText}>{t('customerBookings.pdf')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
    padding: 16,
  },
  title: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  qr: { backgroundColor: colors.white, borderRadius: 10, height: 168, width: 168 },
  code: { color: colors.text, fontFamily: 'monospace', fontSize: 16, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  paid: { color: colors.success, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
});
