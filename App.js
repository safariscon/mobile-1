import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AnnouncementBar, { ANNOUNCEMENT_BAR_SPACE } from './src/components/AnnouncementBar';
import BottomTabs from './src/components/BottomTabs';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import EmailVerificationScreen from './src/screens/EmailVerificationScreen';
import PasswordRecoveryScreen from './src/screens/PasswordRecoveryScreen';
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

const CUSTOMER_PAGE_META = {
  home: { title: 'Home', icon: 'home' },
  services: { title: 'Services', icon: 'grid' },
  bookings: { title: 'Bookings', icon: 'calendar' },
  profile: { title: 'Profile', icon: 'user' },
  notifications: { title: 'Notifications', icon: 'bell' },
  settings: { title: 'Settings', icon: 'settings' },
  support: { title: 'Support', icon: 'help-circle' },
};

const CUSTOMER_MORE_KEYS = ['notifications', 'settings', 'support'];

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
  const [authEmail, setAuthEmail] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [adminMoreVisible, setAdminMoreVisible] = useState(false);
  const [customerMoreVisible, setCustomerMoreVisible] = useState(false);
  const [adminRoute, setAdminRoute] = useState('businesses');
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
      setActiveTab('admin_home');
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
          { key: 'customer_more', label: 'More', icon: 'more-horizontal' },
        ]
      : [
          { key: 'home', label: t('common.home'), icon: 'home' },
          { key: 'services', label: t('common.services'), icon: 'grid' },
        ];

    const guestAuthScreens = {
      login: (
        <LoginScreen
          onBack={() => setAuthScreen(null)}
          onNavigateToRegister={() => setAuthScreen('register')}
          onNavigateToProviderRegistration={() => setAuthScreen('provider')}
          onNavigateToForgotPassword={(email) => {
            setAuthEmail(email || '');
            setAuthScreen('forgot-password');
          }}
          onEmailVerificationRequired={(email) => {
            setAuthEmail(email || '');
            setAuthScreen('verify-email');
          }}
        />
      ),
      register: (
        <RegisterScreen
          onBack={() => setAuthScreen(null)}
          onNavigateToLogin={() => setAuthScreen('login')}
          onNavigateToProviderRegistration={() => setAuthScreen('provider')}
          onEmailVerificationRequired={(email) => {
            setAuthEmail(email || '');
            setAuthScreen('verify-email');
          }}
        />
      ),
      provider: (
        <CompleteProviderRegistrationScreen
          onBack={() => setAuthScreen(null)}
          onNavigateToLogin={() => setAuthScreen('login')}
          onEmailVerificationRequired={(email) => {
            setAuthEmail(email || '');
            setAuthScreen('verify-email');
          }}
        />
      ),
      'verify-email': <EmailVerificationScreen email={authEmail} onBack={() => setAuthScreen('login')} onVerified={() => setAuthScreen(null)} />,
      'forgot-password': <PasswordRecoveryScreen initialEmail={authEmail} onBack={() => setAuthScreen('login')} onDone={() => setAuthScreen('login')} />,
    };

    const screens = {
      home: authScreen && !isAuthenticated ? guestAuthScreens[authScreen] : (
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
          onOpenSettings={isAuthenticated ? () => setActiveTab('settings') : undefined}
          hideTopBar={isAuthenticated}
        />
      ),
      services: <ServicesScreen initialFilters={serviceFilters} onMenuPress={() => setDrawerVisible(true)} onBack={() => setActiveTab('home')} onOpenService={setSelectedService} onRequireAuth={() => setAuthScreen('register')} hideTopBar={isAuthenticated} />,
      bookings: isAuthenticated ? <BookingsScreen onOpenRoute={setRouteBooking} /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
      profile: isAuthenticated ? <ProfileScreen /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
      notifications: isAuthenticated ? <CustomerNotificationsScreen onBrowseServices={() => setActiveTab('services')} /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
      settings: isAuthenticated ? <CustomerSettingsScreen /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
      support: isAuthenticated ? <CustomerSupportScreen /> : <GuestAuthPrompt onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} />,
    };
    currentScreen = authScreen && !isAuthenticated ? guestAuthScreens[authScreen] : screens[activeTab] || screens.home;
    if (isAuthenticated) {
      currentScreen = (
        <CustomerPageFrame
          activeTab={activeTab}
          onOpenNotifications={() => setActiveTab('notifications')}
        >
          {currentScreen}
        </CustomerPageFrame>
      );
    }
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
      { key: 'admin_bookings', label: t('tabs.bookings'), icon: 'calendar' },
      { key: 'admin_insights', label: 'Insights', icon: 'bar-chart-2' },
      { key: 'admin_home', label: t('common.home'), icon: 'home' },
      { key: 'admin_settings', label: 'Settings', icon: 'settings' },
      { key: 'admin_more', label: 'More', icon: 'more-horizontal' },
    ];

    const screens = {
      admin_home: <AdminDashboard tab={adminRoute || 'businesses'} />,
      admin_bookings: <AdminDashboard tab="bookings" />,
      admin_insights: <AdminDashboard tab="insights" />,
      admin_settings: <AdminDashboard tab="settings" />,
      admin_more: <AdminDashboard tab={adminRoute || 'businesses'} />,
      profile: <ProfileScreen />,
    };
    currentScreen = screens[activeTab] || <AdminDashboard tab="home" />;
  }

  const changeTab = (tabKey) => {
    if (tabKey === 'customer_more') {
      setCustomerMoreVisible(true);
      return;
    }
    if (tabKey === 'admin_more') {
      setAdminMoreVisible(true);
      return;
    }
    if (tabKey === 'admin_home') setAdminRoute('businesses');
    if (tabKey === 'admin_bookings') setAdminRoute('bookings');
    if (tabKey === 'admin_insights') setAdminRoute('insights');
    if (tabKey === 'admin_settings') setAdminRoute('settings');
    setActiveTab(tabKey);
  };

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
      <BottomTabs activeTab={CUSTOMER_MORE_KEYS.includes(activeTab) ? 'customer_more' : activeTab} onChangeTab={changeTab} tabs={roleTabs} />
      {isAuthenticated && isTourist ? (
        <CustomerMoreSheet
          visible={customerMoreVisible}
          onClose={() => setCustomerMoreVisible(false)}
          onSelect={(routeKey) => {
            setActiveTab(routeKey);
            setCustomerMoreVisible(false);
          }}
        />
      ) : null}
      {isAdmin ? (
        <AdminMoreSheet
          visible={adminMoreVisible}
          onClose={() => setAdminMoreVisible(false)}
          onSelect={(routeKey) => {
            setAdminRoute(routeKey);
            if (routeKey === 'bookings') setActiveTab('admin_bookings');
            else if (routeKey === 'insights') setActiveTab('admin_insights');
            else if (routeKey === 'settings') setActiveTab('admin_settings');
            else if (routeKey === 'profile') setActiveTab('profile');
            else setActiveTab('admin_more');
            setAdminMoreVisible(false);
          }}
        />
      ) : null}
      <NavigationDrawer
        visible={drawerVisible}
        tabs={roleTabs}
        activeTab={activeTab}
        isAuthenticated={isAuthenticated}
        isDark={isDark}
        user={user}
        onClose={() => setDrawerVisible(false)}
        onSelectTab={(tabKey) => {
          changeTab(tabKey);
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

function CustomerPageFrame({ activeTab, onOpenNotifications, children }) {
  useAppTheme();
  const { colors } = useTheme();
  const page = CUSTOMER_PAGE_META[activeTab] || CUSTOMER_PAGE_META.home;

  return (
    <View style={[styles.customerFrame, { backgroundColor: colors.background }]}>
      <View style={[styles.customerHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.customerHeaderLeft}>
          <View style={[styles.customerBrandMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.customerBrandMarkText}>S</Text>
          </View>
          <View style={styles.customerHeaderCopy}>
            <Text style={[styles.customerBrandName, { color: colors.textStrong }]}>SafarisCon</Text>
            <Text style={[styles.customerPageName, { color: colors.text }]}>{page.title}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.customerHeaderButton, { backgroundColor: colors.primaryLight }]} onPress={onOpenNotifications} activeOpacity={0.84}>
          <Feather name="bell" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.customerFrameBody}>{children}</View>
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

const CUSTOMER_MORE_GROUPS = [
  {
    title: 'Customer tools',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
      { key: 'support', label: 'Support', icon: 'help-circle' },
    ],
  },
];

function CustomerMoreSheet({ visible, onClose, onSelect }) {
  useAppTheme();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.moreBackdrop} onPress={onClose}>
        <Pressable style={[styles.moreSheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.moreHandle} />
          <View style={styles.moreHeader}>
            <Text style={[styles.moreTitle, { color: colors.textStrong }]}>More</Text>
            <TouchableOpacity style={[styles.drawerClose, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {CUSTOMER_MORE_GROUPS.map((group) => (
            <View key={group.title} style={styles.moreGroup}>
              <Text style={[styles.moreGroupTitle, { color: colors.muted }]}>{group.title}</Text>
              <View style={styles.moreGrid}>
                {group.items.map((item) => (
                  <TouchableOpacity key={item.key} style={[styles.moreItem, { backgroundColor: colors.surfaceMuted }]} onPress={() => onSelect(item.key)} activeOpacity={0.84}>
                    <Feather name={item.icon} size={18} color={colors.primary} />
                    <Text style={[styles.moreItemText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CustomerNotificationsScreen({ onBrowseServices }) {
  useAppTheme();
  const { colors } = useTheme();

  const items = [
    { title: 'Booking updates', text: 'Your booking confirmations, payment updates, provider details, and re-book replies will appear here.', icon: 'calendar' },
    { title: 'Service alerts', text: 'Promotions, availability changes, and useful travel updates are kept in this notification center.', icon: 'bell' },
  ];

  return (
    <ScrollView style={[styles.simplePage, { backgroundColor: colors.background }]} contentContainerStyle={styles.simplePageContent} showsVerticalScrollIndicator={false}>
      {items.map((item) => (
        <View key={item.title} style={[styles.customerInfoRow, { backgroundColor: colors.surface }]}>
          <View style={[styles.customerInfoIcon, { backgroundColor: colors.primaryLight }]}>
            <Feather name={item.icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.customerInfoCopy}>
            <Text style={[styles.customerInfoTitle, { color: colors.textStrong }]}>{item.title}</Text>
            <Text style={[styles.customerInfoText, { color: colors.muted }]}>{item.text}</Text>
          </View>
        </View>
      ))}
      <TouchableOpacity style={[styles.customerPrimaryAction, { backgroundColor: colors.primary }]} onPress={onBrowseServices} activeOpacity={0.86}>
        <Text style={styles.customerPrimaryActionText}>Browse services</Text>
        <Feather name="arrow-right" size={17} color={colors.white} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function CustomerSettingsScreen() {
  useAppTheme();
  const { i18n } = useTranslation();
  const { colors, mode, setThemeMode } = useTheme();
  const [languageOpen, setLanguageOpen] = useState(false);
  const currentLanguage = languages.find((language) => i18n.resolvedLanguage === language.code || i18n.language === language.code) || languages[0];

  return (
    <ScrollView style={[styles.simplePage, { backgroundColor: colors.background }]} contentContainerStyle={styles.simplePageContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.customerSectionTitle, { color: colors.textStrong }]}>Theme</Text>
      <View style={styles.customerSettingsGrid}>
        {['light', 'dark'].map((themeMode) => {
          const active = mode === themeMode;
          return (
            <TouchableOpacity key={themeMode} style={[styles.customerSettingChoice, { backgroundColor: active ? colors.primary : colors.surface }]} onPress={() => setThemeMode(themeMode)} activeOpacity={0.84}>
              <Feather name={themeMode === 'dark' ? 'moon' : 'sun'} size={18} color={active ? colors.white : colors.primary} />
              <Text style={[styles.customerSettingChoiceText, { color: active ? colors.white : colors.text }]}>{themeMode === 'dark' ? 'Dark' : 'Light'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.customerSectionTitle, { color: colors.textStrong }]}>Language</Text>
      <TouchableOpacity style={[styles.customerDropdown, { backgroundColor: colors.surface }]} onPress={() => setLanguageOpen(true)} activeOpacity={0.84}>
        <View style={styles.customerDropdownLeft}>
          <Feather name="globe" size={18} color={colors.primary} />
          <Text style={[styles.customerDropdownText, { color: colors.text }]}>{currentLanguage.nativeName}</Text>
        </View>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </TouchableOpacity>

      <Text style={[styles.customerSectionTitle, { color: colors.textStrong }]}>Preferences</Text>
      <View style={[styles.customerInfoRow, { backgroundColor: colors.surface }]}>
        <View style={[styles.customerInfoIcon, { backgroundColor: colors.primaryLight }]}>
          <Feather name="mail" size={18} color={colors.primary} />
        </View>
        <View style={styles.customerInfoCopy}>
          <Text style={[styles.customerInfoTitle, { color: colors.textStrong }]}>Booking communication</Text>
          <Text style={[styles.customerInfoText, { color: colors.muted }]}>Email and in-app booking updates stay enabled for customer accounts.</Text>
        </View>
      </View>

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setLanguageOpen(false)}>
          <Pressable style={[styles.dropdownSheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.dropdownTitle, { color: colors.textStrong }]}>Change language</Text>
            {languages.map((language) => {
              const active = currentLanguage.code === language.code;
              return (
                <TouchableOpacity key={language.code} style={[styles.languageOption, { backgroundColor: active ? colors.primary : colors.surfaceMuted }]} onPress={() => {
                  setAppLanguage(language.code);
                  setLanguageOpen(false);
                }} activeOpacity={0.84}>
                  <Text style={[styles.languageOptionCode, { color: active ? colors.white : colors.primary }]}>{language.shortLabel}</Text>
                  <Text style={[styles.languageOptionText, { color: active ? colors.white : colors.text }]}>{language.nativeName}</Text>
                  {active ? <Feather name="check" size={17} color={colors.white} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function CustomerSupportScreen() {
  useAppTheme();
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.simplePage, { backgroundColor: colors.background }]} contentContainerStyle={styles.simplePageContent} showsVerticalScrollIndicator={false}>
      {[
        ['Need help with a booking?', 'Open your booking and use the available contact or route actions after your provider details are unlocked.', 'message-circle'],
        ['Payments and deposits', 'Confirmed bookings show payment status, deposit amount, and remaining balance in your bookings page.', 'credit-card'],
        ['Re-book requests', 'When available, re-book and cancellation requests are tracked from your bookings page.', 'repeat'],
      ].map(([title, text, icon]) => (
        <View key={title} style={[styles.customerInfoRow, { backgroundColor: colors.surface }]}>
          <View style={[styles.customerInfoIcon, { backgroundColor: colors.primaryLight }]}>
            <Feather name={icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.customerInfoCopy}>
            <Text style={[styles.customerInfoTitle, { color: colors.textStrong }]}>{title}</Text>
            <Text style={[styles.customerInfoText, { color: colors.muted }]}>{text}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const ADMIN_MORE_GROUPS = [
  {
    title: 'Manage',
    items: [
      { key: 'businesses', label: 'Business review', icon: 'shield' },
      { key: 'services', label: 'Services', icon: 'layers' },
      { key: 'users', label: 'Users', icon: 'users' },
      { key: 'register-business', label: 'Service providers', icon: 'user-plus' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { key: 'rebook-requests', label: 'Re-book requests', icon: 'repeat' },
      { key: 'verification', label: 'Verify booking', icon: 'check-square' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
  },
];

function AdminMoreSheet({ visible, onClose, onSelect }) {
  useAppTheme();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.moreBackdrop} onPress={onClose}>
        <Pressable style={[styles.moreSheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.moreHandle} />
          <View style={styles.moreHeader}>
            <Text style={[styles.moreTitle, { color: colors.textStrong }]}>More</Text>
            <TouchableOpacity style={[styles.drawerClose, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {ADMIN_MORE_GROUPS.map((group) => (
            <View key={group.title} style={styles.moreGroup}>
              <Text style={[styles.moreGroupTitle, { color: colors.muted }]}>{group.title}</Text>
              <View style={styles.moreGrid}>
                {group.items.map((item) => (
                  <TouchableOpacity key={item.key} style={[styles.moreItem, { backgroundColor: colors.surfaceMuted }]} onPress={() => onSelect(item.key)} activeOpacity={0.84}>
                    <Feather name={item.icon} size={18} color={colors.primary} />
                    <Text style={[styles.moreItemText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
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
  customerFrame: {
    flex: 1,
  },
  customerFrameBody: {
    flex: 1,
  },
  customerHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 16,
  },
  customerHeaderLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  customerBrandMark: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  customerBrandMarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  customerHeaderCopy: {
    flex: 1,
  },
  customerBrandName: {
    fontSize: 13,
    fontWeight: '900',
  },
  customerPageName: {
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1,
  },
  customerHeaderButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  simplePage: {
    flex: 1,
  },
  simplePageContent: {
    padding: 16,
    paddingBottom: 18,
  },
  customerInfoRow: {
    alignItems: 'flex-start',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 13,
  },
  customerInfoIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  customerInfoCopy: {
    flex: 1,
  },
  customerInfoTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  customerInfoText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  customerPrimaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 4,
  },
  customerPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  customerSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 9,
    marginTop: 6,
  },
  customerSettingsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  customerSettingChoice: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  customerSettingChoiceText: {
    fontSize: 13,
    fontWeight: '900',
  },
  customerDropdown: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: 10,
    paddingHorizontal: 13,
  },
  customerDropdownLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  customerDropdownText: {
    fontSize: 13,
    fontWeight: '900',
  },
  dropdownBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  dropdownSheet: {
    borderRadius: 16,
    padding: 14,
    width: '100%',
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  languageOption: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  languageOptionCode: {
    fontSize: 12,
    fontWeight: '900',
    width: 34,
  },
  languageOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
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
  moreBackdrop: {
    backgroundColor: 'rgba(2, 6, 23, 0.36)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  moreSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    paddingBottom: 22,
  },
  moreHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 5,
    marginBottom: 12,
    width: 46,
  },
  moreHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moreTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moreGroup: {
    marginTop: 8,
  },
  moreGroupTitle: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  moreItem: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    width: '48%',
  },
  moreItemText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
  },
});




