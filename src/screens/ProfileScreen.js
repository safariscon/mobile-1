import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const isAdmin = user?.role === 'admin';
  const displayName = isAdmin ? 'SafarisCon Admin' : user?.name || t('profile.traveler');
  const displayRole = isAdmin ? 'ADMIN' : user?.role?.toUpperCase() || 'TOURIST';
  const initials = isAdmin ? 'SA' : user?.name ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {/* User Detail Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {initials}
          </Text>
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
        <Text style={styles.sectionTitle}>Account security</Text>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity style={styles.optionRow} activeOpacity={0.75}>
          <View style={styles.optionLeft}>
            <Feather name="shield" size={20} color={colors.muted} />
            <Text style={styles.optionLabel}>Multi-factor authentication</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>Set up</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} activeOpacity={0.75}>
          <View style={styles.optionLeft}>
            <Feather name="key" size={20} color={colors.muted} />
            <Text style={styles.optionLabel}>Reset password</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} activeOpacity={0.75}>
          <View style={styles.optionLeft}>
            <Feather name="smartphone" size={20} color={colors.muted} />
            <Text style={styles.optionLabel}>Trusted devices</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.85}>
        <Feather name="log-out" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: colors.dangerSurface,
    marginBottom: 20,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '800',
  },
});
