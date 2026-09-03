import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import PolicyLinks from '../components/PolicyLinks';
import { buildCheckboxCopy } from '../lib/policyContent';
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
  const checkboxCopy = buildCheckboxCopy(t);
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

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Feather name="user-plus" size={20} color={colors.white} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{t('auth.register.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
            </View>
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
            <Text style={styles.checkboxText}>{checkboxCopy.register}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('common.createAccount')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchAuthButton} onPress={onNavigateToLogin} activeOpacity={0.84}>
            <Text style={styles.switchAuthText}>{t('auth.register.hasAccount')}</Text>
            <Text style={styles.switchAuthLink}>{t('common.signIn')}</Text>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.providerLinks}>
            <TouchableOpacity style={styles.providerAction} onPress={onNavigateToProviderRegistration} activeOpacity={0.8}>
              <Feather name="briefcase" size={15} color={colors.primary} />
              <Text style={styles.providerActionText}>Complete provider registration</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.providerAction} onPress={onNavigateToBusinessRegister} activeOpacity={0.8}>
              <Feather name="plus-square" size={15} color={colors.primary} />
              <Text style={styles.providerActionText}>Register a business</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
  },
  page: {
    flexGrow: 1,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12,
    paddingVertical: 4,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  backText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: colors.textStrong,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 5,
  },
  input: {
    ...baseInputStyle(colors),
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordBox: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
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
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    marginTop: 8,
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
    marginTop: 4,
  },
  box: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
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
  switchAuthButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  switchAuthText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  switchAuthLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  providerLinks: {
    gap: 2,
    marginTop: 8,
  },
  providerAction: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
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
  },
  successText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
});
