import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import PolicyLinks from '../components/PolicyLinks';
import { CHECKBOX_COPY } from '../lib/policyContent';
import { lightColors } from '../theme/colors';
import { baseInputStyle, passwordFieldStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ onBack, onNavigateToLogin, onNavigateToProviderRegistration, onNavigateToBusinessRegister, onEmailVerificationRequired }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError(t('auth.register.missingName'));
    if (!emailPattern.test(normalizedEmail)) return setError(t('auth.register.invalidEmail'));
    if (!password) return setError(t('auth.register.missingPassword'));
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError(t('auth.register.passwordMismatch'));
    if (!acceptedTerms) return setError('Accept the Terms of use and Privacy policy to create an account.');

    setError('');
    setSuccess('');
    const result = await register(name.trim(), normalizedEmail, password);
    if (!result.success) {
      setError(result.error || t('auth.register.failed'));
      return;
    }

    if (result.emailVerification?.required || result.user?.emailVerified === false) {
      onEmailVerificationRequired?.(normalizedEmail);
      return;
    }

    setSuccess(t('auth.register.success'));
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setTimeout(onNavigateToLogin, 900);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.75}>
            <Feather name="arrow-left" size={15} color={colors.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Feather name="user-plus" size={24} color={colors.white} />
          </View>
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>

          <View style={styles.accountType}>
            <Feather name="user" size={19} color={colors.primary} />
            <Text style={styles.accountTitle}>{t('auth.register.traveler')}</Text>
            <Text style={styles.accountText}>{t('auth.register.travelerHelp')}</Text>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!success && <Text style={styles.successText}>{success}</Text>}

          <Input label={t('auth.register.fullName')} placeholder={t('auth.register.fullNamePlaceholder')} value={name} onChangeText={setName} />
          <Input label={t('common.email')} placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <PasswordInput label={t('common.password')} placeholder="Create a secure password" value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
          <PasswordInput label={t('auth.register.confirmPassword')} placeholder="Repeat your password" value={confirmPassword} onChangeText={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} />

          <TouchableOpacity style={styles.checkbox} onPress={() => setAcceptedTerms((current) => !current)} activeOpacity={0.84}>
            <View style={[styles.box, acceptedTerms && styles.boxActive]}>
              {acceptedTerms ? <Feather name="check" size={13} color={colors.white} /> : null}
            </View>
            <Text style={styles.checkboxText}>{CHECKBOX_COPY.register}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('common.createAccount')}</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.hasAccount')} </Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.75}>
              <Text style={styles.linkText}>{t('common.signIn')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.providerAction} onPress={onNavigateToProviderRegistration} activeOpacity={0.8}>
            <Feather name="briefcase" size={16} color={colors.primary} />
            <Text style={styles.providerActionText}>Complete provider registration</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.providerAction} onPress={onNavigateToBusinessRegister} activeOpacity={0.8}>
            <Feather name="plus-square" size={16} color={colors.primary} />
            <Text style={styles.providerActionText}>Register a business</Text>
          </TouchableOpacity>
          <PolicyLinks compact />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

function PasswordInput({ label, value, onChangeText, visible, onToggle, placeholder }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordBox}>
        <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.passwordInput} />
        <TouchableOpacity onPress={onToggle} activeOpacity={0.75} style={styles.eyeButton}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={17} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
    marginBottom: 18,
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
  backText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    color: colors.textStrong,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
    marginTop: 7,
    textAlign: 'center',
  },
  accountType: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  accountTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  accountText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  inputGroup: {
    marginBottom: 13,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  input: {
    ...baseInputStyle(colors),
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    height: 52,
    paddingHorizontal: 14,
  },
  passwordBox: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    height: 52,
    overflow: 'hidden',
  },
  passwordInput: {
    ...passwordFieldStyle(colors),
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingHorizontal: 14,
  },
  eyeButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 48,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  checkbox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  box: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  boxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  footerText: {
    color: colors.text,
    fontSize: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  providerAction: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
    paddingVertical: 8,
  },
  providerActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
});
