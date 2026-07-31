import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AnnouncementBar, { ANNOUNCEMENT_BAR_SPACE } from './src/components/AnnouncementBar';
import BottomTabs from './src/components/BottomTabs';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CompleteProviderRegistrationScreen from './src/screens/CompleteProviderRegistrationScreen';
import BusinessRegistrationScreen from './src/screens/BusinessRegistrationScreen';
import BusinessRegistrationStatusScreen from './src/screens/BusinessRegistrationStatusScreen';
import HomeScreen from './src/screens/HomeScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import ServiceDetailsModal from './src/components/ServiceDetailsModal';
import BookingsScreen from './src/screens/BookingsScreen';
import ServiceRouteScreen from './src/screens/ServiceRouteScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SellerDashboard from './src/screens/SellerDashboard';
import AdminDashboard from './src/screens/AdminDashboard';
import { ANALYTICS_EVENTS, trackAnalytics } from './src/lib/analytics';
import { fetchServices } from './src/api/services';
import './src/i18n';
import { languages, loadSavedLanguage, setAppLanguage } from './src/i18n';
import { lightColors } from './src/theme/colors';
import useThemedStyles from './src/theme/useThemedStyles';

let colors = lightColors;
let styles;

function useAppTheme() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  return themed;
}

function LanguageWelcomeScreen({ checking = false, onSelectLanguage }) {
  const { colors: themeColors, isDark } = useAppTheme();
  return (
    <SafeAreaView style={styles.languageWelcome} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar hidden={false} style={isDark ? 'light' : 'dark'} />
      <View style={styles.languageBrand}>
        <View style={styles.languageBrandMark}><Text style={styles.languageBrandMarkText}>S</Text></View>
        <Text style={styles.languageBrandText}>SafarisCon</Text>
      </View>

      <View style={styles.languageBadge}>
        <Feather name="globe" size={15} color={themeColors.primary} />
        <Text style={styles.languageBadgeText}>Language · Ururimi · Langue</Text>
      </View>

      <Text style={styles.languageWelcomeTitle}>Choose your language</Text>
      <Text style={styles.languageWelcomeText}>Hitamo ururimi · Choisissez votre langue</Text>
      <Text style={styles.languageWelcomeHint}>You can change this later from your profile settings.</Text>

      {checking ? (
        <ActivityIndicator color={themeColors.primary} style={styles.languageLoader} />
      ) : (
        <View style={styles.languageChoiceList}>
          {languages.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={styles.languageChoice}
              onPress={() => onSelectLanguage(language.code)}
              activeOpacity={0.84}
            >
              <View style={styles.languageCodePill}>
                <Text style={styles.languageCodeText}>{language.shortLabel}</Text>
              </View>
              <Text style={styles.languageChoiceText}>{language.nativeName}</Text>
              <Feather name="chevron-right" size={18} color={themeColors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

function LanguageGate({ children }) {
  const [checkingLanguage, setCheckingLanguage] = useState(true);
  const [needsLanguage, setNeedsLanguage] = useState(false);
  const [choosingLanguage, setChoosingLanguage] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadSavedLanguage()
      .then((savedLanguage) => {
        if (mounted) setNeedsLanguage(!savedLanguage);
      })
      .finally(() => {
        if (mounted) setCheckingLanguage(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const chooseLanguage = async (language) => {
    if (choosingLanguage) return;
    setChoosingLanguage(true);
    await setAppLanguage(language).then(() => {
      setNeedsLanguage(false);
    }).finally(() => {
      setChoosingLanguage(false);
    });
  };

  if (checkingLanguage) {
    return <LanguageWelcomeScreen checking />;
  }

  if (needsLanguage) {
    return <LanguageWelcomeScreen checking={choosingLanguage} onSelectLanguage={chooseLanguage} />;
  }

  return children;
}

function MainAppContent() {
  useAppTheme();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isAuthenticated, user, restoringSession, isTourist, isSeller, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [authScreen, setAuthScreen] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [serviceFilters, setServiceFilters] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [routeBooking, setRouteBooking] = useState(null);

  // Automatically switch active tab when authentication state or role changes
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTab('home');
    } else if (isSeller) {
      setActiveTab('seller_bookings');
      setEditingBusiness(false);
    } else if (isAdmin) {
      setActiveTab('admin_verifications');
    } else if (isTourist) {
      setActiveTab('bookings');
    } else {
      setActiveTab('home');
    }
  }, [isAuthenticated, isSeller, isAdmin, isTourist]);

  useEffect(() => {
    if (isAuthenticated) {
      setAuthScreen(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    trackAnalytics(ANALYTICS_EVENTS.APP_VISIT, { pageUrl: `safariscon://${activeTab}` });
  }, []);

  useEffect(() => {
    fetchServices().catch(() => {});
  }, []);

  if (restoringSession) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>{t('common.loadingSession')}</Text>
      </View>
    );
  }

  if (!isAuthenticated && authScreen === 'register') {
    return <RegisterScreen onBack={() => setAuthScreen(null)} onNavigateToLogin={() => setAuthScreen('login')} />;
  }

  if (!isAuthenticated && authScreen === 'provider') {
    return <CompleteProviderRegistrationScreen onBack={() => setAuthScreen(null)} onNavigateToLogin={() => setAuthScreen('login')} />;
  }

  if (!isAuthenticated && authScreen === 'login') {
    return (
      <LoginScreen
        onBack={() => setAuthScreen(null)}
        onNavigateToRegister={() => setAuthScreen('register')}
        onNavigateToProviderRegistration={() => setAuthScreen('provider')}
      />
    );
  }

  if (isSeller && user?.mustSetPassword) {
    return <CompleteProviderRegistrationScreen onNavigateToLogin={() => setAuthScreen('login')} />;
  }

  if (isSeller && (!user?.hasBusiness || editingBusiness)) {
    return <BusinessRegistrationScreen onSubmitted={() => setEditingBusiness(false)} />;
  }

  if (isSeller && ['pending', 'draft', 'rejected'].includes(user?.businessStatus || user?.businessReviewStatus)) {
    return <BusinessRegistrationStatusScreen onEdit={() => setEditingBusiness(true)} />;
  }

  if (selectedService) {
    return (
      <ServiceDetailsModal
        asScreen
        visible
        service={selectedService}
        onClose={() => setSelectedService(null)}
        onRequireAuth={() => {
          setSelectedService(null);
          setAuthScreen('register');
        }}
      />
    );
  }

  if (routeBooking) {
    return <ServiceRouteScreen booking={routeBooking} onBack={() => setRouteBooking(null)} />;
  }

  // Define tab navigation based on role
  let roleTabs = [];
  let currentScreen = null;

  if (!isAuthenticated || isTourist) {
    roleTabs = isAuthenticated
      ? [
          { key: 'home', label: t('common.home'), icon: 'home' },
          { key: 'services', label: t('common.services'), icon: 'grid' },
          { key: 'bookings', label: t('tabs.bookings'), icon: 'calendar' },
          { key: 'profile', label: t('common.profile'), icon: 'user' },
        ]
      : [
          { key: 'home', label: t('common.home'), icon: 'home' },
          { key: 'services', label: t('common.services'), icon: 'grid' },
        ];

    const screens = {
      home: (
        <HomeScreen
          onMenuPress={() => setDrawerVisible(true)}
          onLoginPress={!isAuthenticated ? () => setAuthScreen('login') : undefined}
          onRegisterPress={!isAuthenticated ? () => setAuthScreen('register') : undefined}
          onRequireAuth={() => setAuthScreen('register')}
          onBrowseServices={(filters) => {
            setServiceFilters(filters || null);
            setActiveTab('services');
          }}
          onOpenService={setSelectedService}
          onOpenSettings={isAuthenticated ? () => setActiveTab('profile') : undefined}
        />
      ),
      services: <ServicesScreen initialFilters={serviceFilters} onMenuPress={() => setDrawerVisible(true)} onBack={() => setActiveTab('home')} onOpenService={setSelectedService} onRequireAuth={() => setAuthScreen('register')} />,
      bookings: isAuthenticated ? <BookingsScreen onOpenRoute={setRouteBooking} /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
      profile: isAuthenticated ? <ProfileScreen /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
    };
    currentScreen = screens[activeTab] || screens.home;
  } else if (isSeller) {
    roleTabs = [
      { key: 'seller_bookings', label: t('tabs.bookings'), icon: 'calendar' },
      { key: 'seller_rebook', label: 'Re-book', icon: 'repeat' },
      { key: 'seller_verify', label: t('tabs.verifyCode'), icon: 'check-square' },
      { key: 'seller_catalog', label: t('common.catalog'), icon: 'layers' },
      { key: 'profile', label: t('common.profile'), icon: 'user' },
    ];

    const screens = {
      seller_bookings: <SellerDashboard tab="bookings" />,
      seller_rebook: <SellerDashboard tab="rebook" />,
      seller_verify: <SellerDashboard tab="verify" />,
      seller_catalog: <SellerDashboard tab="catalog" />,
      profile: <ProfileScreen />,
    };
    currentScreen = screens[activeTab] || <SellerDashboard tab="bookings" />;
  } else if (isAdmin) {
    roleTabs = [
      { key: 'admin_verifications', label: t('tabs.audits'), icon: 'shield' },
      { key: 'admin_stats', label: t('tabs.stats'), icon: 'bar-chart-2' },
      { key: 'profile', label: t('common.profile'), icon: 'user' },
    ];

    const screens = {
      admin_verifications: <AdminDashboard tab="verifications" />,
      admin_stats: <AdminDashboard tab="stats" />,
      profile: <ProfileScreen />,
    };
    currentScreen = screens[activeTab] || <AdminDashboard tab="verifications" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {!isAuthenticated ? (
        <AnnouncementBar
          fixed
          onBrowseServices={() => {
            setServiceFilters(null);
            setActiveTab('services');
          }}
        />
      ) : null}
      <View style={[styles.content, !isAuthenticated && styles.contentWithAnnouncement, { backgroundColor: colors.background }]}>{currentScreen}</View>
      <BottomTabs activeTab={activeTab} onChangeTab={setActiveTab} tabs={roleTabs} />
      <NavigationDrawer
        visible={drawerVisible}
        tabs={roleTabs}
        activeTab={activeTab}
        isAuthenticated={isAuthenticated}
        isDark={isDark}
        user={user}
        onClose={() => setDrawerVisible(false)}
        onSelectTab={(tabKey) => {
          setActiveTab(tabKey);
          setDrawerVisible(false);
        }}
        onLogin={() => {
          setAuthScreen('login');
          setDrawerVisible(false);
        }}
        onRegister={() => {
          setAuthScreen('register');
          setDrawerVisible(false);
        }}
      />
    </View>
  );
}

function NavigationDrawer({ visible, tabs, activeTab, isAuthenticated, isDark, user, onClose, onSelectTab, onLogin, onRegister }) {
  useAppTheme();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.drawerBackdrop} onPress={onClose}>
        <Pressable style={[styles.drawerPanel, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.drawerHeader}>
            <View style={[styles.drawerBrandMark, { backgroundColor: colors.primary }]}>
              <Text style={styles.drawerBrandMarkText}>S</Text>
            </View>
            <View style={styles.drawerBrandCopy}>
              <Text style={[styles.drawerTitle, { color: colors.textStrong }]}>SafarisCon</Text>
              <Text style={[styles.drawerSubtitle, { color: colors.muted }]}>
                {isAuthenticated ? user?.name || user?.email || 'Welcome back' : 'Explore Rwanda services'}
              </Text>
            </View>
            <TouchableOpacity style={[styles.drawerClose, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.drawerItems}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.drawerItem,
                    { borderColor: colors.border, backgroundColor: active ? colors.primaryLight : colors.surfaceMuted },
                  ]}
                  onPress={() => onSelectTab(tab.key)}
                  activeOpacity={0.84}
                >
                  <Feather name={tab.icon} size={18} color={active ? colors.primary : colors.muted} />
                  <Text style={[styles.drawerItemText, { color: active ? colors.primaryDark : colors.text }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!isAuthenticated ? (
            <View style={styles.drawerAuthActions}>
              <TouchableOpacity style={[styles.drawerPrimaryButton, { backgroundColor: colors.primary }]} onPress={onRegister} activeOpacity={0.86}>
                <Text style={styles.drawerPrimaryText}>Get started</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawerSecondaryButton, { borderColor: colors.border }]} onPress={onLogin} activeOpacity={0.86}>
                <Text style={[styles.drawerSecondaryText, { color: colors.text }]}>Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.drawerFooter, { borderTopColor: colors.border }]}>
            <Feather name={isDark ? 'moon' : 'sun'} size={15} color={colors.muted} />
            <Text style={[styles.drawerFooterText, { color: colors.muted }]}>{isDark ? 'Dark mode' : 'Light mode'}</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AppSafeArea({ children }) {
  useAppTheme();
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView
      style={[styles.appSafeArea, { backgroundColor: colors.surface }]}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <StatusBar hidden={false} style={isDark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

function GuestAuthPrompt({ onLogin, onRegister }) {
  useAppTheme();
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.guestPromptScreen, { backgroundColor: colors.background }]}>
      <View style={[styles.guestPromptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.guestPromptTitle, { color: colors.text }]}>{t('guest.title')}</Text>
        <Text style={[styles.guestPromptText, { color: colors.muted }]}>{t('guest.text')}</Text>
        <TouchableOpacity style={[styles.guestPrimaryButton, { backgroundColor: colors.primary }]} onPress={onRegister} activeOpacity={0.86}>
          <Text style={styles.guestPrimaryText}>{t('common.createAccount')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.guestSecondaryButton, { borderColor: colors.primary }]} onPress={onLogin} activeOpacity={0.86}>
          <Text style={[styles.guestSecondaryText, { color: colors.primary }]}>{t('common.signIn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageGate>
            <AppSafeArea>
              <MainAppContent />
            </AppSafeArea>
          </LanguageGate>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const createStyles = (colors) => StyleSheet.create({
  appSafeArea: {
    flex: 1,
  },
  languageWelcome: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  languageBrand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  languageBrandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  languageBrandMarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  languageBrandText: {
    color: colors.textStrong,
    fontSize: 22,
    fontWeight: '900',
  },
  languageBadge: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  languageWelcomeTitle: {
    color: colors.textStrong,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 24,
    textAlign: 'center',
  },
  languageWelcomeText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 285,
    textAlign: 'center',
  },
  languageWelcomeHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  languageLoader: {
    marginTop: 28,
  },
  languageChoiceList: {
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  languageChoice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
  },
  languageCodePill: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 44,
  },
  languageCodeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  languageChoiceText: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 12,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
  },
  contentWithAnnouncement: {
    paddingTop: ANNOUNCEMENT_BAR_SPACE,
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  guestPromptScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  guestPromptCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 22,
    width: '100%',
  },
  guestPromptTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  guestPromptText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  guestPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 9,
    height: 46,
    justifyContent: 'center',
    width: '100%',
  },
  guestPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  guestSecondaryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 9,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
  },
  guestSecondaryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  drawerBackdrop: {
    backgroundColor: 'rgba(2, 6, 23, 0.46)',
    flex: 1,
  },
  drawerPanel: {
    borderBottomRightRadius: 18,
    borderTopRightRadius: 18,
    elevation: 16,
    height: '100%',
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    width: '82%',
    maxWidth: 340,
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  drawerBrandMark: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  drawerBrandMarkText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  drawerBrandCopy: {
    flex: 1,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  drawerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  drawerClose: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  drawerItems: {
    gap: 10,
    marginTop: 28,
  },
  drawerItem: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '900',
  },
  drawerAuthActions: {
    gap: 10,
    marginTop: 24,
  },
  drawerPrimaryButton: {
    alignItems: 'center',
    borderRadius: 11,
    height: 48,
    justifyContent: 'center',
  },
  drawerPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  drawerSecondaryButton: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
  },
  drawerSecondaryText: {
    fontSize: 14,
    fontWeight: '900',
  },
  drawerFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 16,
  },
  drawerFooterText: {
    fontSize: 12,
    fontWeight: '800',
  },
});




