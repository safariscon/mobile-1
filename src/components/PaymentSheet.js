import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../context/AuthContext';
import { ANALYTICS_EVENTS, trackAnalytics } from '../lib/analytics';
import {
  fetchPaymentMethods,
  getAmountDue,
  openCheckoutUrl,
  paymentOutcome,
  pollPaymentStatus,
  startBookingPayment,
  getPaymentCheckoutUrl,
} from '../lib/payments';
import { SelectField, TextField } from './FormFields';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

function formatMoney(value) {
  return `RWF ${Number(value || 0).toLocaleString()}`;
}

export default function PaymentSheet({ visible, booking, onClose, onPaid }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { user } = useAuth();
  const [methods, setMethods] = useState([]);
  const [pmethod, setPmethod] = useState('momo');
  const [phone, setPhone] = useState(user?.phone || '');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    fetchPaymentMethods()
      .then((items) => {
        if (!active) return;
        setMethods(items);
        if (items[0]?.id) setPmethod(items[0].id);
      })
      .catch(() => {
        if (active) setMethods([
          { id: 'momo', label: 'Mobile Money' },
          { id: 'cc', label: 'Card' },
        ]);
      });
    return () => { active = false; };
  }, [visible]);

  if (!booking) return null;
  const amount = getAmountDue(booking);
  const bookingId = booking._id || booking.id;

  const poll = async () => {
    setPolling(true);
    setMessage('Waiting for payment confirmation...');
    const result = await pollPaymentStatus(bookingId, {
      onUpdate: (data, outcome) => {
        if (outcome === 'success') {
          setMessage('Payment received. Provider details are unlocked.');
          onPaid?.(data.booking || booking);
        }
      },
    });
    setPolling(false);
    if (result.outcome === 'success') {
      trackAnalytics(ANALYTICS_EVENTS.PAYMENT_SUCCESS, { bookingId });
      onPaid?.(result.data?.booking || booking);
      return;
    }
    if (result.outcome === 'failed') {
      trackAnalytics(ANALYTICS_EVENTS.PAYMENT_FAILED, { bookingId });
      setError(result.data?.message || 'Payment failed. You can retry without signing out.');
      return;
    }
    setError('Payment is still pending. Keep this screen open or refresh bookings shortly.');
  };

  const pay = async () => {
    setError('');
    setMessage('');
    if (pmethod === 'momo' && !/^07\d{8}$/.test(String(phone).replace(/\s+/g, ''))) {
      setError('Enter a Mobile Money number like 07XXXXXXXX.');
      return;
    }
    setLoading(true);
    trackAnalytics(ANALYTICS_EVENTS.PAY_DEPOSIT_CLICKED, { bookingId });
    try {
      const data = await startBookingPayment(booking, {
        pmethod,
        email,
        cname: name,
        name,
        phone: String(phone).replace(/\s+/g, ''),
        senderAccount: String(phone).replace(/\s+/g, ''),
      });
      const outcome = paymentOutcome(data, data.booking);
      if (outcome === 'success') {
        trackAnalytics(ANALYTICS_EVENTS.PAYMENT_SUCCESS, { bookingId, paymentId: data.payment?._id });
        setMessage('Payment received. Provider details are unlocked.');
        onPaid?.(data.booking || booking);
        return;
      }
      if (outcome === 'failed') {
        trackAnalytics(ANALYTICS_EVENTS.PAYMENT_FAILED, { bookingId });
        setError(data.message || 'Payment failed. Stay signed in and retry.');
        return;
      }
      const checkoutUrl = getPaymentCheckoutUrl(data);
      if (checkoutUrl && pmethod === 'cc') {
        setMessage('Opening card checkout...');
        await openCheckoutUrl(checkoutUrl);
      } else {
        setMessage('Mobile Money prompt sent. Confirm on your phone.');
      }
      await poll();
    } catch (payError) {
      trackAnalytics(ANALYTICS_EVENTS.PAYMENT_FAILED, { bookingId });
      setError(payError.message || 'Payment could not be started. You are still signed in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Pay in full</Text>
            <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.help}>Pay in full. Money is held until the cancel window ends.</Text>
          <Text style={styles.amount}>{formatMoney(amount)}</Text>
          <SelectField
            label="Payment method"
            value={pmethod}
            options={methods.map((item) => [item.id, item.label])}
            onChange={setPmethod}
            searchable={false}
          />
          <TextField label="Name on payment" value={name} onChangeText={setName} />
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {pmethod === 'cc' ? null : (
            <TextField label="MoMo number (07XXXXXXXX)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
          <TouchableOpacity style={[styles.button, (loading || polling) && styles.disabled]} onPress={pay} disabled={loading || polling} activeOpacity={0.86}>
            {loading || polling ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Pay {formatMoney(amount)}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themeColors.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 36 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: themeColors.textStrong, fontSize: 24, fontWeight: '900' },
  close: { alignItems: 'center', borderColor: themeColors.border, borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  help: { color: themeColors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, marginBottom: 10 },
  amount: { color: themeColors.primary, fontSize: 28, fontWeight: '900', marginBottom: 16 },
  error: { color: themeColors.danger, fontSize: 12, fontWeight: '900', marginTop: 10 },
  success: { color: themeColors.success, fontSize: 12, fontWeight: '900', marginTop: 10 },
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, height: 52, justifyContent: 'center', marginTop: 16 },
  disabled: { opacity: 0.72 },
  buttonText: { color: themeColors.white, fontSize: 15, fontWeight: '900' },
});
