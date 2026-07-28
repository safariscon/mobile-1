import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MultilineField, NumberField, SelectField, TextField } from '../components/FormFields';
import { apiFetch } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { RWANDA_DISTRICTS, RWANDA_PROVINCES, SERVICE_CATEGORY_OPTIONS } from '../data/formOptions';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function BusinessRegistrationScreen({ onSubmitted }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { token, refreshUser } = useAuth();
  const [form, setForm] = useState({
    title: '',
    category: 'hotel-rooms',
    description: '',
    province: '',
    district: '',
    sector: '',
    cell: '',
    village: '',
    latitude: '',
    longitude: '',
    payoutName: '',
    payoutNumber: '',
    optionName: '',
    optionPrice: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title || !form.category || !form.province || !form.district || !form.sector || !form.payoutName || !form.payoutNumber || !form.optionName || !form.optionPrice) {
      setError(t('businessRegistration.required'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiFetch('/seller/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          name: form.title,
          category: form.category,
          description: form.description,
          availableQuantity: 1,
          serviceLocation: {
            province: form.province,
            district: form.district,
            sector: form.sector,
            cell: form.cell,
            village: form.village,
            latitude: form.latitude,
            longitude: form.longitude,
            locationSource: 'admin_manual',
          },
          payoutDetails: {
            method: 'mobile-money',
            accountName: form.payoutName,
            accountNumber: form.payoutNumber,
          },
          availabilityTable: {
            rows: [
              {
                id: 'option_1',
                cells: {
                  service: form.optionName,
                  price: form.optionPrice,
                  priceType: 'fixed',
                  calculationField: 'fixed',
                  durationUnit: 'none',
                  maximumDuration: 0,
                  availability: 1,
                  details: form.description,
                },
              },
            ],
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(t('businessRegistration.failed'));

      setSuccess(t('businessRegistration.submitted'));
      await refreshUser(token);
      onSubmitted?.();
    } catch (submitError) {
      setError(t('businessRegistration.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('businessRegistration.title')}</Text>
        <Text style={styles.text}>{t('businessRegistration.description')}</Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!success && <Text style={styles.successText}>{success}</Text>}

        <TextField label={t('seller.businessName')} value={form.title} onChangeText={(value) => update('title', value)} />
        <SelectField label={t('businessRegistration.businessCategory')} value={form.category} options={SERVICE_CATEGORY_OPTIONS} onChange={(value) => update('category', value)} placeholder="Select category" />
        <MultilineField label={t('businessRegistration.businessDescription')} value={form.description} onChangeText={(value) => update('description', value)} placeholder="Example: We rent clean cars in Kigali with a driver or self-drive option." />
        <SelectField label={t('customerBookings.province')} value={form.province} options={RWANDA_PROVINCES.map((province) => [province, province || 'Select province'])} onChange={(value) => update('province', value)} placeholder="Select province" />
        <SelectField label={t('customerBookings.district')} value={form.district} options={[['', 'Select district'], ...RWANDA_DISTRICTS.map((district) => [district, district])]} onChange={(value) => update('district', value)} placeholder="Select district" />
        <TextField label={t('customerBookings.sector')} value={form.sector} onChangeText={(value) => update('sector', value)} />
        <TextField label={t('seller.cell')} value={form.cell} onChangeText={(value) => update('cell', value)} />
        <TextField label={t('seller.village')} value={form.village} onChangeText={(value) => update('village', value)} />
        <NumberField allowDecimal allowNegative label={t('seller.latitude')} value={form.latitude} onChangeText={(value) => update('latitude', value)} />
        <NumberField allowDecimal allowNegative label={t('seller.longitude')} value={form.longitude} onChangeText={(value) => update('longitude', value)} />
        <TextField label={t('seller.payoutAccountName')} value={form.payoutName} onChangeText={(value) => update('payoutName', value)} />
        <TextField label={t('seller.payoutAccountNumber')} value={form.payoutNumber} onChangeText={(value) => update('payoutNumber', value)} keyboardType="phone-pad" />
        <TextField label={t('businessRegistration.firstOption')} value={form.optionName} onChangeText={(value) => update('optionName', value)} />
        <NumberField label={t('businessRegistration.optionPrice')} value={form.optionPrice} onChangeText={(value) => update('optionPrice', value)} />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.86}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('businessRegistration.submit')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingTop: 58,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
});
