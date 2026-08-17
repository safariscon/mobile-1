import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import PolicyLinks from '../components/PolicyLinks';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

function getLoginErrorDetails(message) {
  const original = String(message || '').trim();
  const text = original.toLowerCase();
  if (text.includes('timed out') || text.includes('backend request')) {
    return { message: original || 'Backend request timed out.', cause: 'Cause: the app could not reach the backend before the request timeout.' };
  }
  if (text.includes('network request') || text.includes('failed to fetch') || text.includes('backend is not reachable')) {
    return { message: original || 'Backend is not reachable.', cause: 'Cause: check the API address, backend server, CORS, or device network.' };
  }
  if (text.includes('invalid credentials') || text.includes('login failed')) {
    return { message: original || 'Login failed.', cause: 'Cause: email or password is not accepted by the backend.' };
  }
  return { message: original || 'Login failed.', cause: 'Cause: the backend rejected the sign in request.' };
}
export default function LoginScreen({ onBack, onNavigateToRegister, onNavigateToProviderRegistration, onNavigateToBusinessRegister, onNavigateToForgotPassword, onEmailVerificationRequired, onLoginOtpRequired, initialEmail = '' }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError({ message: t('auth.login.missing'), cause: 'Cause: email and password are required.' });
      return;
    }

    setError(null);
    const result = await login(normalizedEmail, password, rememberMe);
    if (!result.success) {
      if (result.status === 403 && result.code === 'EMAIL_NOT_VERIFIED') {
        onEmailVerificationRequired?.(normalizedEmail);
        return;
      }
      setError(getLoginErrorDetails(result.error || t('auth.login.failed')));
      return;
    }
    if (result.otpRequired) {
      onLoginOtpRequired?.(normalizedEmail);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.75}>
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Feather name="log-in" size={24} color={colors.white} />
          </View>
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error.message}</Text>
              <Text style={styles.errorCause}>{error.cause}</Text>
            </View>
          )}

          <Input label={t('common.email')} placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <PasswordInput
            label={t('common.password')}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />

          <TouchableOpacity style={styles.forgotButton} onPress={() => onNavigateToForgotPassword?.(email.trim().toLowerCase())} activeOpacity={0.75}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((current) => !current)} activeOpacity={0.84}>
            <View style={[styles.rememberBox, rememberMe && styles.rememberBoxActive]}>
              {rememberMe ? <Feather name="check" size={12} color={colors.white} /> : null}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('common.signIn')}</Text>}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.footerText}>{t('auth.login.noAccount')} </Text>
            <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.75}>
              <Text style={styles.linkText}>{t('auth.login.signUp')}</Text>
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
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PasswordInput({ label, value, onChangeText, visible, onToggle, placeholder }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordBox}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.passwordInput}
        />
        <TouchableOpacity onPress={onToggle} activeOpacity={0.75} style={styles.eyeButton}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
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
    marginBottom: 22,
  },
  backText: {
    color: colors.primary,
    fontSize: 13,
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
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorCause: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
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
  },
  passwordInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingHorizontal: 14,
  },
  eyeButton: {
    alignItems: 'center',
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
  signupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.text,
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginTop: -4,
    paddingVertical: 4,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  providerActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  rememberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  rememberBox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  rememberBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});




