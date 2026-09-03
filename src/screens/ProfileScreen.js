import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAppDialog } from '../components/AppDialog';
import PolicyLinks from '../components/PolicyLinks';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchSellerPaymentProviders, fetchSellerPayoutDetails, saveSellerPayoutDetails } from '../api/seller';
import { roleLabel, userInitials } from '../lib/navigation';
import { baseInputStyle } from '../theme/inputStyles';

export default function ProfileScreen({ onNavigateTab }) {
  const { t } = useTranslation();
  const { user, logout, isSeller, isAdmin, forgotPassword, resetPassword, updateProfile, getAccountDeletionStatus, deleteAccount, loading } = useAuth();
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
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('momo');
  const [payoutProviderId, setPayoutProviderId] = useState('mtn');
  const [payoutName, setPayoutName] = useState('');
  const [payoutNumber, setPayoutNumber] = useState('');
  const [providers, setProviders] = useState({ mobileMoneyProviders: [], bankProviders: [] });

  useEffect(() => {
    let cancelled = false;
    getAccountDeletionStatus()
      .then((status) => {
        if (!cancelled) setDeletionStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDeletionStatus(null);
      });
    return () => { cancelled = true; };
  }, [getAccountDeletionStatus, user?._id || user?.id]);

  useEffect(() => {
    if (!isSeller) return;
    let cancelled = false;
    (async () => {
      try {
        const [payout, paymentProviders] = await Promise.all([
          fetchSellerPayoutDetails().catch(() => ({})),
          fetchSellerPaymentProviders().catch(() => ({ mobileMoneyProviders: [], bankProviders: [] })),
        ]);
        if (cancelled) return;
        const method = String(payout?.method || 'momo').toLowerCase().includes('bank') ? 'bank' : 'momo';
        setPayoutMethod(method);
        setPayoutProviderId(payout?.providerId || (method === 'bank' ? 'equity' : 'mtn'));
        setPayoutName(payout?.accountName || '');
        setPayoutNumber(payout?.accountNumber || payout?.msisdn || '');
        setProviders(paymentProviders);
      } catch {
        // keep empty payout form
      }
    })();
    return () => { cancelled = true; };
  }, [isSeller]);

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
    if (!payoutName.trim() || !payoutNumber.trim()) {
      showResult(t('common.error'), t('seller.validation.payoutRequired'), 'error');
      return;
    }
    setSavingPayout(true);
    try {
      const method = payoutMethod === 'bank' ? 'bank' : 'momo';
      const saved = await saveSellerPayoutDetails({
        method,
        providerId: payoutProviderId || (method === 'bank' ? 'equity' : 'mtn'),
        accountName: payoutName.trim(),
        accountNumber: payoutNumber.trim(),
        ...(method === 'momo' ? { msisdn: payoutNumber.trim() } : {}),
      });
      setPayoutMethod(String(saved?.method || method).includes('bank') ? 'bank' : 'momo');
      setPayoutProviderId(saved?.providerId || payoutProviderId);
      setPayoutName(saved?.accountName || payoutName);
      setPayoutNumber(saved?.accountNumber || saved?.msisdn || payoutNumber);
      showResult(t('common.success'), 'Payout details saved.');
    } catch (saveError) {
      showResult(t('common.error'), saveError.message, 'error');
    } finally {
      setSavingPayout(false);
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

  const goToSellerServices = () => {
    if (typeof onNavigateTab === 'function') {
      onNavigateTab('seller_services');
    }
  };

  const confirmDeleteAccount = () => {
    if (isAdmin) {
      showResult(t('common.error'), 'Admin accounts cannot be self-deleted.', 'error');
      return;
    }
    if (deletionStatus && !deletionStatus.canDelete) {
      if (deletionStatus.redirect === 'seller_services' || deletionStatus.code === 'PROVIDER_MUST_DELETE_SERVICES') {
        showResult('Delete services first', deletionStatus.message || 'Remove all services before deleting your account.', 'error');
        goToSellerServices();
        return;
      }
      showResult(t('common.error'), deletionStatus.message || 'Account cannot be deleted yet.', 'error');
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      showResult(t('common.error'), 'Type DELETE in the box to confirm.', 'error');
      return;
    }
    askConfirm({
      title: 'Delete account?',
      message: 'This permanently removes your account and cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
      onConfirm: async () => {
        closeDialog();
        const result = await deleteAccount('DELETE');
        if (result.success) {
          showResult(t('common.success'), 'Account deleted.');
          return;
        }
        if (result.details) setDeletionStatus(result.details);
        if (result.code === 'PROVIDER_MUST_DELETE_SERVICES' || result.details?.redirect === 'seller_services') {
          goToSellerServices();
        }
        showResult(t('common.error'), result.error || 'Could not delete account.', 'error');
      },
    });
  };

  const providerList = payoutMethod === 'bank' ? providers.bankProviders : providers.mobileMoneyProviders;

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@safariscon.com'}</Text>
          <View style={styles.roleBadge}>
            <Feather name="shield" size={13} color={colors.primaryDark} />
            <Text style={styles.roleText}>{displayRole}</Text>
          </View>
          {user?.sellerId ? <Text style={styles.helpText}>Seller ID: {user.sellerId}</Text> : null}
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
          <Text style={styles.helpText}>Same MoMo / bank payout account as Finance → Payout.</Text>
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodChip, payoutMethod === 'momo' && styles.methodChipActive]}
              onPress={() => {
                setPayoutMethod('momo');
                setPayoutProviderId(providers.mobileMoneyProviders[0]?.id || 'mtn');
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.methodChipText, payoutMethod === 'momo' && styles.methodChipTextActive]}>Mobile Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodChip, payoutMethod === 'bank' && styles.methodChipActive]}
              onPress={() => {
                setPayoutMethod('bank');
                setPayoutProviderId(providers.bankProviders[0]?.id || 'equity');
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.methodChipText, payoutMethod === 'bank' && styles.methodChipTextActive]}>Bank</Text>
            </TouchableOpacity>
          </View>
          {providerList.length ? (
            <View style={styles.methodRow}>
              {providerList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.methodChip, payoutProviderId === item.id && styles.methodChipActive]}
                  onPress={() => setPayoutProviderId(item.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.methodChipText, payoutProviderId === item.id && styles.methodChipTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput value={payoutName} onChangeText={setPayoutName} placeholder="Account name" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={payoutNumber} onChangeText={setPayoutNumber} placeholder="Account / MoMo number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
          <TouchableOpacity style={styles.saveButton} onPress={savePayout} disabled={savingPayout} activeOpacity={0.85}>
            {savingPayout ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save payout</Text>}
          </TouchableOpacity>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Policies</Text>
      </View>
      <PolicyLinks />

      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>Delete account</Text>
        <Text style={styles.helpText}>
          Permanently remove your SafarisCon account. This cannot be undone.
        </Text>
        {deletionStatus ? (
          <View style={styles.deletionCard}>
            <Text style={styles.deletionMessage}>{deletionStatus.message}</Text>
            {deletionStatus.blockers?.services > 0 ? (
              <Text style={styles.deletionMeta}>Services listed: {deletionStatus.blockers.services}</Text>
            ) : null}
            {deletionStatus.blockers?.pendingBookings > 0 ? (
              <Text style={styles.deletionMeta}>Pending bookings: {deletionStatus.blockers.pendingBookings}</Text>
            ) : null}
            {deletionStatus.blockers?.paidBookings > 0 ? (
              <Text style={styles.deletionMeta}>Paid / unlocked bookings: {deletionStatus.blockers.paidBookings}</Text>
            ) : null}
            {deletionStatus.blockers?.unpaidBookings > 0 && deletionStatus.canDelete ? (
              <Text style={styles.deletionMeta}>Unpaid bookings to fail: {deletionStatus.blockers.unpaidBookings}</Text>
            ) : null}
          </View>
        ) : null}
        {(deletionStatus?.redirect === 'seller_services' || deletionStatus?.code === 'PROVIDER_MUST_DELETE_SERVICES') ? (
          <TouchableOpacity style={styles.saveButton} onPress={goToSellerServices} activeOpacity={0.85}>
            <Text style={styles.saveText}>Go to my services</Text>
          </TouchableOpacity>
        ) : null}
        {!isAdmin ? (
          <>
            <TextInput
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteAccount} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.deleteButtonText}>Delete my account</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.helpText}>Admin accounts cannot be self-deleted.</Text>
        )}
      </View>

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
    overflow: 'hidden',
  },
  avatarImage: {
    height: 64,
    width: 64,
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
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  methodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  methodChipTextActive: {
    color: colors.white,
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
    ...baseInputStyle(colors),
    borderRadius: 12,
    borderWidth: 1,
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
  dangerSection: {
    borderColor: '#FECACA',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 8,
    padding: 14,
    backgroundColor: isDark ? '#3f1515' : '#FFF5F5',
  },
  deletionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  deletionMessage: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  deletionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
});
