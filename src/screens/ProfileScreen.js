import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAppDialog } from '../components/AppDialog';
import PolicyLinks from '../components/PolicyLinks';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../config/api';
import { roleLabel, userInitials } from '../lib/navigation';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, isSeller, forgotPassword, resetPassword, updateProfile, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const { dialogNode, showResult, askConfirm, closeDialog } = useAppDialog();
  const displayName = user?.name || t('profile.traveler');
  const displayRole = roleLabel(user);
  const initials = userInitials(user);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [payoutName, setPayoutName] = useState(user?.payoutDetails?.accountName || '');
  const [payoutNumber, setPayoutNumber] = useState(user?.payoutDetails?.accountNumber || '');

  const saveProfile = async () => {
    const result = await updateProfile({ name: name.trim(), phone: phone.trim() });
    if (result.success) showResult(t('common.success'), 'Profile updated.');
    else showResult(t('common.error'), result.error || 'Could not update profile.', 'error');
  };

  const sendPasswordOtp = async () => {
    const result = await forgotPassword(user?.email);
    if (result.success) showResult(t('common.success'), 'Password reset code sent to your email.');
    else showResult(t('common.error'), result.error || 'Could not send password code.', 'error');
  };

  const savePassword = async () => {
    const result = await resetPassword(user?.email, otp.trim(), newPassword);
    if (result.success) showResult(t('common.success'), 'Password updated.');
    else showResult(t('common.error'), result.error || 'Could not update password.', 'error');
  };

  const savePayout = async () => {
    try {
      const response = await apiFetch('/hotel/overview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutDetails: { method: 'momo', accountName: payoutName, accountNumber: payoutNumber, msisdn: payoutNumber } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not save payout details.');
      showResult(t('common.success'), 'Payout details saved.');
    } catch (saveError) {
      showResult(t('common.error'), saveError.message, 'error');
    }
  };

  const confirmLogout = () => {
    askConfirm({
      title: t('profile.logoutTitle'),
      message: t('profile.logoutMessage'),
      confirmLabel: t('common.logout'),
      destructive: true,
      onConfirm: () => {
        closeDialog();
        logout();
      },
    });
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@safariscon.com'}</Text>
          <View style={styles.roleBadge}>
            <Feather name="shield" size={13} color={colors.primaryDark} />
            <Text style={styles.roleText}>{displayRole}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Profile</Text>
      </View>
      <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
      <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save profile</Text>}
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Password</Text>
      </View>
      <Text style={styles.helpText}>Password changes use an email OTP, same as the web app.</Text>
      <TouchableOpacity style={styles.optionRow} onPress={sendPasswordOtp} activeOpacity={0.75}>
        <View style={styles.optionLeft}>
          <Feather name="mail" size={20} color={colors.muted} />
          <Text style={styles.optionLabel}>Send password OTP</Text>
        </View>
      </TouchableOpacity>
      <TextInput value={otp} onChangeText={setOtp} placeholder="OTP code" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} />
      <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
      <TouchableOpacity style={styles.saveButton} onPress={savePassword} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.saveText}>Update password</Text>
      </TouchableOpacity>

      {isSeller ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payout</Text>
          </View>
          <TextInput value={payoutName} onChangeText={setPayoutName} placeholder="Account name" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={payoutNumber} onChangeText={setPayoutNumber} placeholder="MoMo / account number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
          <TouchableOpacity style={styles.saveButton} onPress={savePayout} activeOpacity={0.85}>
            <Text style={styles.saveText}>Save payout</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Policies</Text>
      </View>
      <PolicyLinks />

      <TouchableOpacity style={styles.logoutLink} onPress={confirmLogout} activeOpacity={0.85}>
        <Feather name="log-out" size={16} color="#DC2626" />
        <Text style={styles.logoutLinkText}>{t('common.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
    {dialogNode}
    </>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingTop: 26,
    paddingBottom: 16,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 18,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.22 : 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  avatarCircle: {
    height: 64,
    width: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    marginRight: 16,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  userEmail: {
    color: colors.muted,
    fontSize: 13,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  roleText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  optionsList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  optionValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  devNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  devRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 26,
  },
  devButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  devButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  devButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  devButtonTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  logoutLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
    paddingVertical: 8,
  },
  logoutLinkText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 48,
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    marginBottom: 16,
  },
  saveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
});
