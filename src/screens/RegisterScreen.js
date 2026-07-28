import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ onBack, onNavigateToLogin }) {
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError(t('auth.register.missingName'));
    if (!emailPattern.test(normalizedEmail)) return setError(t('auth.register.invalidEmail'));
    if (!password) return setError(t('auth.register.missingPassword'));
    if (password !== confirmPassword) return setError(t('auth.register.passwordMismatch'));

    setError('');
    setSuccess('');
    const result = await register(name.trim(), normalizedEmail, password);
    if (!result.success) {
      setError(result.error || t('auth.register.failed'));
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
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.75}>
            <Feather name="arrow-left" size={15} color={colors.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>

          <View style={styles.accountType}>
            <Feather name="user" size={19} color="#1558D6" />
            <Text style={styles.accountTitle}>{t('auth.register.traveler')}</Text>
            <Text style={styles.accountText}>{t('auth.register.travelerHelp')}</Text>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!success && <Text style={styles.successText}>{success}</Text>}

          <Input label={t('auth.register.fullName')} placeholder={t('auth.register.fullNamePlaceholder')} value={name} onChangeText={setName} />
          <Input label={t('common.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <PasswordInput label={t('common.password')} value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
          <PasswordInput label={t('auth.register.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('common.createAccount')}</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.hasAccount')} </Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.75}>
              <Text style={styles.linkText}>{t('common.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#98A2B3" style={styles.input} {...props} />
    </View>
  );
}

function PasswordInput({ label, value, onChangeText, visible, onToggle }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordBox}>
        <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" placeholderTextColor="#98A2B3" style={styles.passwordInput} />
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
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: '#D6E0F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 22,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  backText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text,
    fontSize: 12,
    marginBottom: 24,
    marginTop: 7,
    textAlign: 'center',
  },
  accountType: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: '#1558D6',
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 12,
    padding: 13,
  },
  accountTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  accountText: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
  },
  inputGroup: {
    marginBottom: 9,
  },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: '#C9D8EE',
    borderRadius: 7,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    height: 34,
    paddingHorizontal: 12,
  },
  passwordBox: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: '#C9D8EE',
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    height: 34,
  },
  passwordInput: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    height: '100%',
    paddingHorizontal: 12,
  },
  eyeButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1558D6',
    borderRadius: 7,
    height: 40,
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 21,
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
