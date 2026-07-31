import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { TextField } from '../components/FormFields';
import { useAuth } from '../context/AuthContext';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function PasswordRecoveryScreen({ initialEmail = '', onBack, onDone }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { forgotPassword, resetPassword, loading } = useAuth();
  const [step, setStep] = useState('forgot');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requestCode = async () => {
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setError('');
    const result = await forgotPassword(email.trim().toLowerCase());
    if (!result.success) {
      setError(result.error || 'Could not send reset code.');
      return;
    }
    setMessage('Password reset code sent.');
    setStep('reset');
  };

  const submitReset = async () => {
    if (!email.trim() || !otp.trim() || !newPassword) {
      setError('Email, code, and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    const result = await resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
    if (!result.success) {
      setError(result.error || 'Could not reset password.');
      return;
    }
    setMessage('Password changed. You can sign in now.');
    onDone?.();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{step === 'forgot' ? 'Reset password' : 'Create new password'}</Text>
        <Text style={styles.text}>{step === 'forgot' ? 'We will send a one-time code to your account email.' : 'Enter the code from your email and choose a new password.'}</Text>
        <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        {step === 'reset' ? (
          <>
            <TextField label="Reset code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" />
            <TextField label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
            <TextField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" secureTextEntry autoCapitalize="none" />
          </>
        ) : null}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!message && <Text style={styles.successText}>{message}</Text>}
        <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={step === 'forgot' ? requestCode : submitReset} disabled={loading} activeOpacity={0.86}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{step === 'forgot' ? 'Send reset code' : 'Reset password'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 30 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginBottom: 26 },
  backText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  title: { color: colors.textStrong, fontSize: 29, fontWeight: '900', textAlign: 'center' },
  text: { color: colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 21, marginBottom: 16, marginTop: 8, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', marginTop: 16 },
  disabled: { opacity: 0.72 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '900', marginTop: 10 },
  successText: { color: colors.success, fontSize: 12, fontWeight: '900', marginTop: 10 },
});
