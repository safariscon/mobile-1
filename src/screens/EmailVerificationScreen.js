import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { TextField } from '../components/FormFields';
import { useAuth } from '../context/AuthContext';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function EmailVerificationScreen({ email: initialEmail = '', onBack, onVerified }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { verifyEmailOtp, resendEmailOtp, loading } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !otp.trim()) {
      setError('Email and verification code are required.');
      return;
    }
    setError('');
    setMessage('');
    const result = await verifyEmailOtp(email.trim().toLowerCase(), otp.trim());
    if (!result.success) {
      setError(result.error || 'Verification failed.');
      return;
    }
    setMessage('Email verified. Redirecting...');
    onVerified?.(result.user);
  };

  const resend = async () => {
    if (!email.trim()) {
      setError('Enter your email before requesting a new code.');
      return;
    }
    setError('');
    const result = await resendEmailOtp(email.trim().toLowerCase());
    setMessage(result.success ? 'A new verification code was sent.' : '');
    if (!result.success) setError(result.error || 'Could not resend verification code.');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.iconMark}><Feather name="mail" size={24} color={colors.white} /></View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.text}>Enter the 6-digit code sent to your email so we can finish setting up your account.</Text>
        <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Verification code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" />
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!message && <Text style={styles.successText}>{message}</Text>}
        <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading} activeOpacity={0.86}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify email</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={resend} disabled={loading} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Resend code</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 30 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginBottom: 22 },
  backText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  iconMark: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 56, justifyContent: 'center', marginBottom: 14, width: 56 },
  title: { color: colors.textStrong, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  text: { color: colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 21, marginBottom: 16, marginTop: 8, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', marginTop: 16 },
  disabled: { opacity: 0.72 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '900', marginTop: 10 },
  successText: { color: colors.success, fontSize: 12, fontWeight: '900', marginTop: 10 },
});
