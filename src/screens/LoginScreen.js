import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
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
export default function LoginScreen({ onBack, onNavigateToRegister, onNavigateToProviderRegistration }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError({ message: t('auth.login.missing'), cause: 'Cause: email and password are required.' });
      return;
    }

    setError(null);
    const result = await login(normalizedEmail, password);
    if (!result.success) {
      setError(getLoginErrorDetails(result.error || t('auth.login.failed')));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.75}>
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error.message}</Text>
              <Text style={styles.errorCause}>{error.cause}</Text>
            </View>
          )}

          <Input label={t('common.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <PasswordInput
            label={t('common.password')}
            value={password}
            onChangeText={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('common.signIn')}</Text>}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.footerText}>{t('auth.login.noAccount')} </Text>
            <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.75}>
              <Text style={styles.linkText}>{t('auth.login.signUp')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.providerText}>{t('auth.login.providerQuestion')}</Text>
          <TouchableOpacity onPress={onNavigateToProviderRegistration} activeOpacity={0.75}>
            <Text style={styles.providerLink}>{t('auth.login.providerLink')}</Text>
          </TouchableOpacity>
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
        placeholderTextColor="#98A2B3"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PasswordInput({ label, value, onChangeText, visible, onToggle }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordBox}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholderTextColor="#98A2B3"
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 28,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12,
  },
  backText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text,
    fontSize: 16,
    marginBottom: 28,
    marginTop: 10,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderColor: '#FCA5A5',
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
    backgroundColor: colors.infoSurface,
    borderColor: '#C9D8EE',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 44,
    paddingHorizontal: 14,
  },
  passwordBox: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: '#C9D8EE',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
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
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1558D6',
    borderRadius: 9,
    height: 44,
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
  providerText: {
    color: colors.text,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  providerLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
});




