import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SelectField, TextField } from '../components/FormFields';
import PolicyLinks from '../components/PolicyLinks';
import ServiceLocationPicker from '../components/ServiceLocationPicker';
import { useAuth } from '../context/AuthContext';
import { SERVICE_CATEGORY_OPTIONS } from '../data/formOptions';
import { locationToText } from '../lib/geo';
import { buildCheckboxCopy } from '../lib/policyContent';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function PublicBusinessRegisterScreen({ onBack, onNavigateToLogin, onEmailVerificationRequired }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const checkboxCopy = buildCheckboxCopy(t);
  const { registerBusiness, loading } = useAuth();
  const [form, setForm] = useState({
    businessName: '',
    businessType: 'hotel-rooms',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessDescription: '',
    serviceName: '',
    servicePrice: '',
    acceptedTerms: false,
    location: {},
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.businessName.trim() || !form.ownerName.trim() || !form.email.trim() || !form.password) {
      setError('Business name, owner name, email, and password are required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Both passwords must be the same.');
      return;
    }
    if (!form.location.country || !(form.location.city || form.location.district)) {
      setError('Country and city are required.');
      return;
    }
    if (!form.acceptedTerms) {
      setError('Accept the terms to create a provider account.');
      return;
    }
    setError('');
    setSuccess('');
    const result = await registerBusiness({
      businessName: form.businessName.trim(),
      businessType: form.businessType,
      ownerName: form.ownerName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      businessDescription: form.businessDescription.trim(),
      serviceName: form.serviceName.trim() || form.businessName.trim(),
      servicePrice: form.servicePrice,
      acceptedTerms: true,
      location: locationToText(form.location),
      serviceLocation: {
        country: form.location.country,
        countryCode: form.location.countryCode,
        state: form.location.state,
        province: form.location.state,
        city: form.location.city,
        district: form.location.city,
        sector: form.location.area || form.location.sector,
        area: form.location.area || form.location.sector,
        latitude: form.location.latitude,
        longitude: form.location.longitude,
        latitudeRaw: form.location.latitudeRaw || String(form.location.latitude || ''),
        longitudeRaw: form.location.longitudeRaw || String(form.location.longitude || ''),
        formattedAddress: form.location.formattedAddress || form.location.fullAddress,
        fullAddress: form.location.fullAddress || form.location.formattedAddress,
        placeName: form.location.placeName,
        referenceName: form.location.referenceName,
        placeId: form.location.placeId,
        locationSource: form.location.locationSource || 'search',
        isExactLocationVerified: Boolean(form.location.isExactLocationVerified),
      },
    });
    if (!result.success) {
      setError(result.error || 'Business registration failed.');
      return;
    }
    if (result.emailVerification?.required || result.user?.emailVerified === false) {
      onEmailVerificationRequired?.(form.email.trim().toLowerCase());
      return;
    }
    setSuccess('Business account created. Opening seller workspace...');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.iconMark}><Feather name="briefcase" size={24} color={colors.white} /></View>
        <Text style={styles.title}>Register your business</Text>
        <Text style={styles.text}>Create a provider account. After review you can publish listings from the seller dashboard.</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}
        <TextField label="Business name" value={form.businessName} onChangeText={(value) => update('businessName', value)} />
        <SelectField label="Business type" value={form.businessType} options={SERVICE_CATEGORY_OPTIONS} onChange={(value) => update('businessType', value)} />
        <TextField label="Owner name" value={form.ownerName} onChangeText={(value) => update('ownerName', value)} />
        <TextField label="Email" value={form.email} onChangeText={(value) => update('email', value)} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Phone" value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" />
        <TextField label="Password" value={form.password} onChangeText={(value) => update('password', value)} secureTextEntry />
        <TextField label="Confirm password" value={form.confirmPassword} onChangeText={(value) => update('confirmPassword', value)} secureTextEntry />
        <TextField label="Business description" value={form.businessDescription} onChangeText={(value) => update('businessDescription', value)} />
        <TextField label="First service name" value={form.serviceName} onChangeText={(value) => update('serviceName', value)} />
        <TextField label="Starting price (RWF)" value={form.servicePrice} onChangeText={(value) => update('servicePrice', value)} keyboardType="number-pad" />
        <ServiceLocationPicker
          value={form.location}
          onChange={(location) => update('location', location)}
          title="Business location"
          help="Search your place, select a result, and address fields plus the map pin fill in automatically."
        />
        <TouchableOpacity style={styles.checkbox} onPress={() => update('acceptedTerms', !form.acceptedTerms)} activeOpacity={0.84}>
          <View style={[styles.box, form.acceptedTerms && styles.boxActive]}>
            {form.acceptedTerms ? <Feather name="check" size={13} color={colors.white} /> : null}
          </View>
            <Text style={styles.checkboxText}>{checkboxCopy.register}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading} activeOpacity={0.86}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create business account</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onNavigateToLogin} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
        <PolicyLinks />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themeColors.background },
  content: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 32 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginBottom: 18 },
  backText: { color: themeColors.primary, fontSize: 13, fontWeight: '900' },
  iconMark: { alignItems: 'center', alignSelf: 'center', backgroundColor: themeColors.primary, borderRadius: 18, height: 56, justifyContent: 'center', marginBottom: 14, width: 56 },
  title: { color: themeColors.textStrong, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  text: { color: themeColors.muted, fontSize: 14, fontWeight: '700', lineHeight: 21, marginBottom: 14, marginTop: 8, textAlign: 'center' },
  error: { color: themeColors.danger, fontSize: 12, fontWeight: '900', marginBottom: 8 },
  success: { color: themeColors.success, fontSize: 12, fontWeight: '900', marginBottom: 8 },
  checkbox: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 8 },
  box: { borderColor: themeColors.border, borderRadius: 6, borderWidth: 1, height: 22, width: 22 },
  boxActive: { alignItems: 'center', backgroundColor: themeColors.primary, borderColor: themeColors.primary, justifyContent: 'center' },
  checkboxText: { color: themeColors.text, flex: 1, fontSize: 12, fontWeight: '700' },
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, height: 52, justifyContent: 'center', marginTop: 16 },
  disabled: { opacity: 0.72 },
  buttonText: { color: themeColors.white, fontSize: 15, fontWeight: '900' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: themeColors.primary, fontSize: 13, fontWeight: '900' },
});
