import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { languages, setAppLanguage } from '../i18n';

export default function ProfileScreen() {
  const { i18n, t } = useTranslation();
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
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

      {/* Settings Options */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
      </View>

      <View style={styles.optionsList}>
        <View style={[styles.optionRow, styles.languageRow]}>
          <View style={styles.optionLeft}>
            <Feather name="globe" size={20} color={colors.muted} />
            <Text style={styles.optionLabel}>{t('common.language')}</Text>
          </View>
          <View style={styles.languageButtons}>
            {languages.map((language) => {
              const active = i18n.resolvedLanguage === language.code || i18n.language === language.code;
              return (
                <TouchableOpacity
                  key={language.code}
                  style={[styles.languageButton, active && styles.languageButtonActive]}
                  onPress={() => setAppLanguage(language.code)}
                  activeOpacity={0.78}
                >
                  <Text style={[styles.languageButtonText, active && styles.languageButtonTextActive]}>{t(language.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.optionRow} onPress={toggleTheme} activeOpacity={0.75}>
          <View style={styles.optionLeft}>
            <Feather name={isDark ? 'sun' : 'moon'} size={20} color={colors.muted} />
            <Text style={styles.optionLabel}>{t('profile.darkMode')}</Text>
          </View>
          <View style={[styles.themeSwitch, isDark && styles.themeSwitchActive]}>
            <View style={[styles.themeKnob, isDark && styles.themeKnobActive]} />
            <Text style={[styles.themeSwitchText, isDark && styles.themeSwitchTextActive]}>{isDark ? t('profile.on') : t('profile.off')}</Text>
          </View>
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
    paddingTop: 62,
    paddingBottom: 24,
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
  languageRow: {
    alignItems: 'flex-start',
    gap: 12,
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
  themeSwitch: {
    alignItems: 'center',
    backgroundColor: isDark ? colors.primaryLight : '#F1F5F9',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minWidth: 74,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  themeSwitchActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeKnob: {
    backgroundColor: colors.muted,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  themeKnobActive: {
    backgroundColor: '#FFFFFF',
  },
  themeSwitchText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  themeSwitchTextActive: {
    color: '#FFFFFF',
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    maxWidth: '58%',
  },
  languageButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  languageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  languageButtonTextActive: {
    color: colors.white,
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
