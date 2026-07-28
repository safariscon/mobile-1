import { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SelectField } from '../components/FormFields';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
import useServices from '../hooks/useServices';
import { RWANDA_DISTRICTS } from '../data/formOptions';
import { languages, setAppLanguage } from '../i18n';
import { getVisiblePromotion } from '../lib/promotion';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const heroImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

const shortcuts = [
  { labelKey: 'home.shortcuts.accommodation', icon: 'home' },
  { labelKey: 'home.shortcuts.transport', icon: 'truck' },
  { labelKey: 'home.shortcuts.events', icon: 'calendar' },
  { labelKey: 'home.shortcuts.travel', icon: 'map' },
  { labelKey: 'home.shortcuts.tours', icon: 'compass' },
  { labelKey: 'home.shortcuts.shopping', icon: 'shopping-bag' },
  { labelKey: 'home.shortcuts.wellness', icon: 'activity' },
  { labelKey: 'home.shortcuts.more', icon: 'more-horizontal' },
];

const workflow = [
  { step: '1', labelKey: 'home.workflow.choose', textKey: 'home.workflow.chooseText', icon: 'search' },
  { step: '2', labelKey: 'home.workflow.book', textKey: 'home.workflow.bookText', icon: 'send' },
  { step: '3', labelKey: 'home.workflow.pay', textKey: 'home.workflow.payText', icon: 'credit-card' },
  { step: '4', labelKey: 'home.workflow.unlock', textKey: 'home.workflow.unlockText', icon: 'lock' },
  { step: '5', labelKey: 'home.workflow.enjoy', textKey: 'home.workflow.enjoyText', icon: 'file-text' },
];

export default function HomeScreen({ onLoginPress, onRegisterPress, onRequireAuth, onBrowseServices, onOpenSettings, onOpenService }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { i18n, t } = useTranslation();
  const { services, loading, error, retry } = useServices();
  const [selectedService, setSelectedService] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const shortcutRailRef = useRef(null);
  const workflowRailRef = useRef(null);
  const shortcutOffsetRef = useRef(0);
  const workflowOffsetRef = useRef(0);

  const featuredServices = useMemo(() => services.slice(0, 6), [services]);

  const browseServices = (filters) => {
    onBrowseServices?.(filters || {});
  };

  const handleOpenDetails = (service) => {
    if (onOpenService) {
      onOpenService(service);
      return;
    }
    setSelectedService(service);
    setIsModalVisible(true);
  };

  const scrollRailNext = (ref, offsetRef, itemWidth) => {
    const nextOffset = offsetRef.current + itemWidth;
    offsetRef.current = nextOffset;
    ref.current?.scrollTo({ x: nextOffset, animated: true });
  };

  const scrollRailBack = (ref, offsetRef, itemWidth) => {
    const nextOffset = Math.max(0, offsetRef.current - itemWidth);
    offsetRef.current = nextOffset;
    ref.current?.scrollTo({ x: nextOffset, animated: true });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => browseServices()} activeOpacity={0.8}>
            <Feather name="menu" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Feather name="hexagon" size={15} color={colors.white} />
            </View>
            <Text style={styles.brandText}>safariscon</Text>
          </View>

          {onLoginPress && onRegisterPress ? (
            <View style={styles.authActions}>
              <TouchableOpacity style={styles.loginButton} onPress={onLoginPress} activeOpacity={0.82}>
                <Text style={styles.loginButtonText}>{t('home.login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signupButton} onPress={onRegisterPress} activeOpacity={0.82}>
                <Text style={styles.signupButtonText}>{t('home.register')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={retry} activeOpacity={0.8}>
                <Feather name="bell" size={19} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings} activeOpacity={0.8}>
                <Feather name="settings" size={19} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {onLoginPress && onRegisterPress ? (
          <View style={styles.guestLanguageBar}>
            <View style={styles.guestLanguageLabel}>
              <Feather name="globe" size={14} color={colors.primary} />
              <Text style={styles.guestLanguageText}>{t('common.language')}</Text>
            </View>
            <View style={styles.guestLanguageButtons}>
              {languages.map((language) => {
                const active = i18n.resolvedLanguage === language.code || i18n.language === language.code;
                return (
                  <TouchableOpacity
                    key={language.code}
                    style={[styles.guestLanguageButton, active && styles.guestLanguageButtonActive]}
                    onPress={() => setAppLanguage(language.code)}
                    activeOpacity={0.78}
                  >
                    <Text style={[styles.guestLanguageButtonText, active && styles.guestLanguageButtonTextActive]}>
                      {language.code.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
            <Text style={styles.heroText}>{t('home.heroText')}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            placeholder={t('home.search')}
            placeholderTextColor="#98A2B3"
            value={serviceSearch}
            onChangeText={setServiceSearch}
            returnKeyType="search"
            onSubmitEditing={() => browseServices({ service: serviceSearch.trim(), location: locationSearch })}
            style={styles.searchInput}
          />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => browseServices({ service: serviceSearch.trim(), location: locationSearch })}
            activeOpacity={0.8}
          >
            <Feather name="search" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.homeLocationSelect}>
          <SelectField
            label={t('servicesScreen.location')}
            value={locationSearch}
            options={[['', t('servicesScreen.selectDistrict')], ...RWANDA_DISTRICTS.map((district) => [district, district])]}
            onChange={setLocationSearch}
            placeholder={t('servicesScreen.selectDistrict')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.explore')}</Text>
        </View>

        <View style={styles.railWrap}>
          <TouchableOpacity
            style={[styles.nextPill, styles.backPill]}
            onPress={() => scrollRailBack(shortcutRailRef, shortcutOffsetRef, 96)}
            activeOpacity={0.82}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
          </TouchableOpacity>
          <ScrollView
            ref={shortcutRailRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutRail}
            onScroll={(event) => {
              shortcutOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
          >
            {shortcuts.map((item) => (
              <TouchableOpacity key={item.labelKey} style={styles.shortcutItem} onPress={() => browseServices({ service: t(item.labelKey) })} activeOpacity={0.82}>
                <View style={styles.shortcutIcon}>
                  <Feather name={item.icon} size={19} color={colors.primary} />
                </View>
                <Text style={styles.shortcutLabel}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.nextPill}
            onPress={() => scrollRailNext(shortcutRailRef, shortcutOffsetRef, 96)}
            activeOpacity={0.82}
          >
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.centeredSectionHeader}>
          <Text style={styles.centeredSectionTitle}>{t('home.howItWorks')}</Text>
        </View>

        <View style={styles.railWrap}>
          <TouchableOpacity
            style={[styles.nextPill, styles.backPill, styles.workflowNextPill]}
            onPress={() => scrollRailBack(workflowRailRef, workflowOffsetRef, 134)}
            activeOpacity={0.82}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
          </TouchableOpacity>
          <ScrollView
            ref={workflowRailRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.workflowRail}
            onScroll={(event) => {
              workflowOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
          >
          {workflow.map((item) => (
            <View key={item.labelKey} style={styles.workflowItem}>
              <View style={styles.workflowIcon}>
                <Feather name={item.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{item.step}</Text>
              </View>
              <Text style={styles.workflowLabel}>{t(item.labelKey)}</Text>
              <Text style={styles.workflowText}>{t(item.textKey)}</Text>
            </View>
          ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.nextPill, styles.workflowNextPill]}
            onPress={() => scrollRailNext(workflowRailRef, workflowOffsetRef, 134)}
            activeOpacity={0.82}
          >
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.featured')}</Text>
          <TouchableOpacity onPress={() => browseServices()} activeOpacity={0.75}>
            <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{t('home.loading')}</Text>
          </View>
        ) : null}

        {!!error ? (
          <TouchableOpacity style={styles.statusBox} onPress={retry} activeOpacity={0.8}>
            <Text style={styles.statusText}>{t('home.loadError')}</Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {featuredServices.map((service) => {
            const promotion = getVisiblePromotion(service.promotion);
            return (
              <TouchableOpacity
                key={service.id}
                style={styles.featuredCard}
                activeOpacity={0.9}
                onPress={() => handleOpenDetails(service)}
              >
                <View>
                  <Image source={{ uri: service.image }} style={styles.featuredImage} />
                  {promotion ? (
                    <View style={styles.featuredPromotionBadge}>
                      <Text style={styles.featuredPromotionText}>-{promotion.percent}%</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.featuredBody}>
                  <Text style={styles.featuredTitle} numberOfLines={1}>{service.title}</Text>
                  {promotion ? <Text style={styles.featuredPromotionTitle} numberOfLines={1}>{promotion.title}</Text> : null}
                  <View style={styles.featuredMeta}>
                    <Feather name="map-pin" size={12} color={colors.muted} />
                    <Text style={styles.featuredLocation} numberOfLines={1}>{service.generalLocation || service.location}</Text>
                  </View>
                  <Text style={styles.featuredPrice}>{service.price}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>

      <ServiceDetailsModal
        visible={isModalVisible}
        service={selectedService}
        onClose={() => setIsModalVisible(false)}
        onRequireAuth={() => {
          setIsModalVisible(false);
          onRequireAuth?.();
        }}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 46,
    paddingBottom: 28,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  brandText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  authActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  guestLanguageBar: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: -4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  guestLanguageLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  guestLanguageText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  guestLanguageButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  guestLanguageButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 25,
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: 6,
  },
  guestLanguageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guestLanguageButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  guestLanguageButtonTextActive: {
    color: colors.white,
  },
  loginButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 9,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  loginButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  signupButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  signupButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  hero: {
    borderRadius: 18,
    height: 178,
    overflow: 'hidden',
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 39, 94, 0.42)',
  },
  heroCopy: {
    bottom: 18,
    left: 18,
    position: 'absolute',
    right: 18,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
    maxWidth: 255,
  },
  heroText: {
    color: '#EAF2FF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 7,
    maxWidth: 250,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    marginHorizontal: 8,
    marginTop: -23,
    paddingLeft: 14,
    paddingRight: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  homeLocationSelect: {
    marginHorizontal: 8,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  railWrap: {
    position: 'relative',
  },
  shortcutRail: {
    backgroundColor: colors.surface,
    borderColor: '#D6E3F7',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 7,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  shortcutItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#E7EEF9',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: 8,
    minHeight: 82,
    paddingHorizontal: 7,
    width: 88,
  },
  shortcutIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 32,
  },
  shortcutLabel: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
    marginTop: 5,
    minHeight: 24,
    textAlign: 'center',
  },
  nextPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    top: 29,
    width: 38,
    elevation: 4,
  },
  backPill: {
    left: -6,
    right: undefined,
  },
  centeredSectionHeader: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  centeredSectionTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  workflowRail: {
    gap: 8,
    paddingBottom: 2,
  },
  workflowItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#D6E3F7',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 144,
    paddingHorizontal: 10,
    paddingVertical: 14,
    width: 126,
  },
  workflowIcon: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    marginTop: 8,
    width: 22,
  },
  stepBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  workflowLabel: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  workflowText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  workflowNextPill: {
    top: 53,
  },
  statusBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  statusText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  featuredRow: {
    paddingRight: 2,
  },
  featuredCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    marginRight: 12,
    overflow: 'hidden',
    width: 172,
  },
  featuredImage: {
    height: 104,
    width: '100%',
  },
  featuredPromotionBadge: {
    backgroundColor: '#FBBF24',
    borderColor: '#F59E0B',
    borderRadius: 999,
    borderWidth: 1,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  featuredPromotionText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
  },
  featuredBody: {
    padding: 10,
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  featuredPromotionTitle: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  featuredMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 5,
  },
  featuredLocation: {
    color: colors.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  featuredPrice: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
});








