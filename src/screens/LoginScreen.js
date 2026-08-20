import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import PolicyLinks from '../components/PolicyLinks';
import { lightColors } from '../theme/colors';
import { baseInputStyle, passwordFieldStyle } from '../theme/inputStyles';
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

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Feather name="log-in" size={20} color={colors.white} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{t('auth.login.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
            </View>
          </View>

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

          <TouchableOpacity style={styles.switchAuthButton} onPress={onNavigateToRegister} activeOpacity={0.84}>
            <Text style={styles.switchAuthText}>{t('auth.login.noAccount')}</Text>
            <Text style={styles.switchAuthLink}>{t('auth.login.signUp')}</Text>
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
  backText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
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
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  errorCause: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
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
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 6,
    marginTop: -2,
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
    marginBottom: 6,
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




