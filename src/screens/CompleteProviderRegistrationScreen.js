import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function CompleteProviderRegistrationScreen({ onBack, onNavigateToLogin, onEmailVerificationRequired }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { completeProviderRegistration, loading } = useAuth();
  const [providerName, setProviderName] = useState('');
  const [providerEmail, setProviderEmail] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!providerName.trim() || !providerEmail.trim() || !sellerId.trim() || !newPassword) {
      setError(t('auth.provider.missing'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.provider.shortPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }

    setError('');
    const result = await completeProviderRegistration({
      providerName: providerName.trim(),
      providerEmail: providerEmail.trim().toLowerCase(),
      sellerId: sellerId.trim().toUpperCase(),
      generatedPassword,
      newPassword,
    });

    if (!result.success) {
      setError(result.error || t('auth.provider.failed'));
      return;
    }
    if (result.emailVerification?.required || result.user?.emailVerified === false) {
      onEmailVerificationRequired?.(providerEmail.trim().toLowerCase());
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          {onBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.75}>
              <Feather name="arrow-left" size={15} color={colors.primary} />
              <Text style={styles.backText}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.heroIcon}>
            <Feather name="briefcase" size={24} color={colors.white} />
          </View>
          <Text style={styles.title}>{t('auth.provider.title')}</Text>
          <Text style={styles.description}>{t('auth.provider.description')}</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{t('auth.provider.info')}</Text>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Input placeholder={t('auth.provider.providerName')} value={providerName} onChangeText={setProviderName} />
          <Input placeholder={t('common.email')} value={providerEmail} onChangeText={setProviderEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input placeholder={t('auth.provider.providerId')} value={sellerId} onChangeText={setSellerId} autoCapitalize="characters" />
          <Input placeholder={`${t('auth.provider.temporaryPassword')} (optional)`} value={generatedPassword} onChangeText={setGeneratedPassword} secureTextEntry autoCapitalize="none" />
          <Input placeholder={t('auth.provider.newPassword')} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
          <Input placeholder={t('auth.register.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('auth.provider.submit')}</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.provider.completed')} </Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.75}>
              <Text style={styles.linkText}>{t('auth.provider.loginHere')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input(props) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />;
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  page: {
    flexGrow: 1,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 20,
  },
  backText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  heroIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: 56,
    elevation: 5,
  },
  title: {
    color: colors.textStrong,
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  infoText: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 52,
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerText: {
    color: colors.text,
    fontSize: 13,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 9,
  },
});
