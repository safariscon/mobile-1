import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MultilineField, NumberField, SelectField, TextField } from '../components/FormFields';
import ServiceLocationPicker from '../components/ServiceLocationPicker';
import { categorySelectOptions, fetchServiceCategories } from '../api/categories';
import { apiFetch } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { SERVICE_CATEGORY_OPTIONS } from '../data/formOptions';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

async function apiFetchFirst(paths, options) {
  let lastResponse = null;
  for (const path of paths) {
    const response = await apiFetch(path, options);
    lastResponse = response;
    if (response.ok || ![404, 405].includes(response.status)) return response;
  }
  return lastResponse;
}

export default function BusinessRegistrationScreen({ onSubmitted }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { token, refreshUser } = useAuth();
  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    category: 'hotel-rooms',
    description: '',
    location: {
      country: '',
      countryCode: '',
      state: '',
      city: '',
      sector: '',
      area: '',
      latitude: '',
      longitude: '',
      formattedAddress: '',
      fullAddress: '',
    },
    payoutName: '',
    payoutNumber: '',
    optionName: '',
    optionPrice: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchServiceCategories({ seller: true })
      .then((payload) => {
        const list = payload.categories || [];
        setCategories(list);
        if (list[0] && !form.categoryId) {
          setForm((current) => ({
            ...current,
            categoryId: list[0]._id || list[0].id,
            category: list[0].slug || list[0].name,
          }));
        }
      })
      .catch(() => setCategories([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const categoryOptions = categories.length ? categorySelectOptions(categories) : SERVICE_CATEGORY_OPTIONS;

  const handleSubmit = async () => {
    const location = form.location || {};
    if (!form.title || !form.categoryId || !location.country || !(location.city || location.district) || !form.payoutName || !form.payoutNumber || !form.optionName || !form.optionPrice) {
      setError(t('businessRegistration.required'));
      return;
    }
    if (!location.latitude && !location.latitudeRaw) {
      setError('Search and select a place so the map pin is set.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiFetchFirst(['/hotel/services', '/seller/services'], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          name: form.title,
          categoryId: form.categoryId,
          description: form.description,
          availableQuantity: 1,
          basePrice: Number(form.optionPrice) || 0,
          serviceLocation: {
            country: location.country,
            countryCode: location.countryCode,
            state: location.state,
            province: location.state,
            city: location.city,
            district: location.city,
            sector: location.area || location.sector,
            area: location.area || location.sector,
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeRaw: location.latitudeRaw || String(location.latitude || ''),
            longitudeRaw: location.longitudeRaw || String(location.longitude || ''),
            formattedAddress: location.formattedAddress || location.fullAddress,
            fullAddress: location.fullAddress || location.formattedAddress,
            placeName: location.placeName,
            referenceName: location.referenceName,
            placeId: location.placeId,
            locationSource: location.locationSource || 'search',
            isExactLocationVerified: Boolean(location.isExactLocationVerified),
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
        <SelectField
          label={t('businessRegistration.businessCategory')}
          value={form.categoryId}
          options={categoryOptions}
          onChange={(value) => {
            const match = categories.find((item) => String(item._id || item.id) === String(value));
            update('categoryId', String(match?._id || match?.id || value));
            update('category', match?.slug || match?.name || '');
          }}
          placeholder="Select category"
        />
        <MultilineField label={t('businessRegistration.businessDescription')} value={form.description} onChangeText={(value) => update('description', value)} placeholder="Example: We rent clean cars in Kigali with a driver or self-drive option." />
        <ServiceLocationPicker
          value={form.location}
          onChange={(location) => update('location', location)}
          title="Business location"
          help="Search your place, select a result, and the map pin plus address fields fill in automatically."
        />
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
