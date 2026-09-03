import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { SelectField } from '../components/FormFields';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
import { fetchServices, getCachedServices } from '../api/services';
import { RWANDA_DISTRICTS } from '../data/formOptions';
import { getVisiblePromotion } from '../lib/promotion';
import { lightColors } from '../theme/colors';
import { baseInputStyle, passwordFieldStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const filters = [
  ['All', 'servicesScreen.filters.all'],
  ['Hotels', 'servicesScreen.filters.hotels'],
  ['Tours', 'servicesScreen.filters.tours'],
  ['Food', 'servicesScreen.filters.food'],
  ['Rides', 'servicesScreen.filters.rides'],
];

const SORT_OPTION_DEFS = [
  ['recommended', 'servicesScreen.recommended'],
  ['price-low', 'servicesScreen.priceLowToHigh'],
  ['price-high', 'servicesScreen.priceHighToLow'],
  ['rating', 'servicesScreen.highestRated'],
];

function formatLabel(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueOptions(items, getValue, emptyLabel) {
  const seen = new Map();
  items.forEach((item) => {
    const value = getValue(item);
    if (!value) return;
    const key = String(value);
    if (!seen.has(key)) seen.set(key, formatLabel(key));
  });
  return [['', emptyLabel], ...Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))];
}

export default function ServicesScreen({ onBack, onMenuPress, onRequireAuth, onOpenService, initialFilters, hideTopBar = false }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const cachedFirstPage = getCachedServices();
  const [services, setServices] = useState(() => cachedFirstPage?.services || []);
  const [pagination, setPagination] = useState(() => cachedFirstPage?.pagination || { page: 1, hasNextPage: false, totalPages: 0 });
  const [loading, setLoading] = useState(() => !cachedFirstPage);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const loadedPagesRef = useRef(new Set());
  const pageSize = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!initialFilters) return;
    setServiceFilter(initialFilters.service || '');
    setLocationFilter(initialFilters.location || '');
    setSearchQuery(initialFilters.search || '');
    setDebouncedSearch(initialFilters.search || '');
  }, [initialFilters]);

  const mergeUnique = (current, incoming, replace) => {
    if (replace) return incoming;
    const seen = new Set(current.map((item) => item.id));
    return current.concat(incoming.filter((item) => !seen.has(item.id)));
  };

  const loadPage = useCallback(async ({ page = 1, replace = false, force = false } = {}) => {
    if (loadedPagesRef.current.has(page) && !replace) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (page === 1 && !replace) setLoading(true);
    if (page > 1) setLoadingMore(true);
    setError('');
    try {
      const response = await fetchServices({ page, limit: pageSize, signal: controller.signal, force });
      if (requestId !== requestIdRef.current) return;
      loadedPagesRef.current.add(page);
      setServices((current) => mergeUnique(current, response.services || [], replace || page === 1));
      setPagination(response.pagination || { page, hasNextPage: false, totalPages: page });
    } catch (loadError) {
      if (loadError.name !== 'AbortError') {
        setError(loadError.message || t('backend.liveServicesFailed'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [t]);

  useEffect(() => {
    loadedPagesRef.current.clear();
    loadPage({ page: 1, replace: true });
    return () => abortRef.current?.abort();
  }, [loadPage]);

  useEffect(() => {
    const refreshCatalog = () => {
      loadedPagesRef.current.clear();
      loadPage({ page: 1, replace: true });
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshCatalog();
    });
    return () => {
      subscription.remove();
    };
  }, [loadPage]);

  const serviceOptions = useMemo(
    () => uniqueOptions(services, (service) => service.serviceCategory || service.category || service.businessType, t('servicesScreen.allServices')),
    [services, t]
  );
  const locationOptions = useMemo(
    () => [['', t('servicesScreen.selectDistrict')], ...RWANDA_DISTRICTS.map((district) => [district, district])],
    [t]
  );
  const sortOptions = useMemo(
    () => SORT_OPTION_DEFS.map(([value, labelKey]) => [value, t(labelKey)]),
    [t]
  );

  const filteredServices = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const result = services.filter((service) => {
      const haystack = [
        service.title,
        service.category,
        service.serviceCategory,
        service.businessType,
        service.description,
        service.location,
        service.generalLocation,
        service.district,
        service.address,
        service.destinationLocation,
      ].join(' ').toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      const selectedService = serviceFilter.toLowerCase();
      const matchesService = !selectedService || haystack.includes(selectedService) || String(service.serviceCategory || '').toLowerCase() === selectedService;
      const selectedLocation = locationFilter.toLowerCase();
      const locationText = [
        service.location,
        service.generalLocation,
        service.district,
        service.address,
        service.destinationLocation,
      ].join(' ').toLowerCase();
      const matchesLocation = !selectedLocation || locationText.includes(selectedLocation);
      const category = String(service.category || '').toLowerCase();
      const matchesFilter =
        activeFilter === 'All' ||
        category.includes(activeFilter.toLowerCase().replace('hotels', 'hotel')) ||
        haystack.includes(activeFilter.toLowerCase());
      const matchesAvailability = !availableOnly || Number(service.availableInventory ?? 1) > 0;

      return matchesSearch && matchesService && matchesLocation && matchesFilter && matchesAvailability;
    });

    result.sort((a, b) => {
      if (sortBy === 'price-low') return Number(a.priceAmount || 0) - Number(b.priceAmount || 0);
      if (sortBy === 'price-high') return Number(b.priceAmount || 0) - Number(a.priceAmount || 0);
      if (sortBy === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return Number(b.rating || 0) - Number(a.rating || 0);
    });

    return result;
  }, [activeFilter, availableOnly, debouncedSearch, locationFilter, serviceFilter, services, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setServiceFilter('');
    setLocationFilter('');
    setActiveFilter('All');
    setSortBy('recommended');
    setAvailableOnly(false);
  };

  const activeChips = [
    serviceFilter ? [t('servicesScreen.serviceChip'), formatLabel(serviceFilter), () => setServiceFilter('')] : null,
    locationFilter ? [t('servicesScreen.locationChip'), locationFilter, () => setLocationFilter('')] : null,
    activeFilter !== 'All' ? [t('servicesScreen.categoryChip'), t(filters.find(([filter]) => filter === activeFilter)?.[1] || 'servicesScreen.filters.all'), () => setActiveFilter('All')] : null,
    availableOnly ? [t('servicesScreen.availableOnly'), t('servicesScreen.availableNowShort'), () => setAvailableOnly(false)] : null,
    sortBy !== 'recommended' ? [t('servicesScreen.sortChip'), sortOptions.find(([value]) => value === sortBy)?.[1] || sortBy, () => setSortBy('recommended')] : null,
  ].filter(Boolean);

  const handleOpenDetails = (service) => {
    if (onOpenService) {
      onOpenService(service);
      return;
    }
    setSelectedService(service);
    setIsModalVisible(true);
  };

  const retry = useCallback(() => {
    loadedPagesRef.current.clear();
    loadPage({ page: 1, replace: true, force: true });
  }, [loadPage]);

  const refresh = useCallback(() => {
    loadedPagesRef.current.clear();
    setRefreshing(true);
    loadPage({ page: 1, replace: true, force: true });
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !pagination?.hasNextPage) return;
    loadPage({ page: Number(pagination.page || 1) + 1 });
  }, [loadPage, loading, loadingMore, pagination]);

  const renderService = useCallback(({ item }) => (
    <ServiceRow service={item} onPress={handleOpenDetails} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  const header = (
    <>
      {!hideTopBar ? <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress || onBack} activeOpacity={0.8}>
          <Feather name={onMenuPress ? 'menu' : 'arrow-left'} size={19} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle}>{t('servicesScreen.title')}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={clearFilters} activeOpacity={0.8}>
          <Feather name="sliders" size={18} color={colors.text} />
        </TouchableOpacity>
      </View> : null}

      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          placeholder={t('servicesScreen.search')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.input}
        />
      </View>

      <View style={styles.filtersPanel}>
        <SelectField
          compact
          style={styles.filterField}
          label={t('servicesScreen.serviceName')}
          value={serviceFilter}
          options={serviceOptions}
          onChange={setServiceFilter}
          placeholder={t('servicesScreen.allServices')}
        />
        <SelectField
          compact
          style={styles.filterField}
          label={t('servicesScreen.location')}
          value={locationFilter}
          options={locationOptions}
          onChange={setLocationFilter}
          placeholder={t('servicesScreen.selectDistrict')}
        />
        <SelectField
          compact
          style={styles.filterField}
          label={t('servicesScreen.sortBy')}
          value={sortBy}
          options={sortOptions}
          onChange={setSortBy}
          placeholder={t('servicesScreen.recommended')}
          searchable={false}
        />
        <TouchableOpacity
          style={[styles.availableToggle, availableOnly && styles.availableToggleActive]}
          onPress={() => setAvailableOnly((value) => !value)}
          activeOpacity={0.84}
        >
          <Feather name={availableOnly ? 'check-square' : 'square'} size={16} color={availableOnly ? colors.white : colors.primary} />
          <Text style={[styles.availableToggleText, availableOnly && styles.availableToggleTextActive]}>{t('servicesScreen.availableOnly')}</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map(([filter, labelKey]) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filter, isActive && styles.filterActive]}
                activeOpacity={0.85}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{t(labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeChips.length ? (
        <View style={styles.activeFilters}>
          {activeChips.map(([label, value, onRemove]) => (
            <TouchableOpacity key={`${label}-${value}`} style={styles.activeChip} onPress={onRemove} activeOpacity={0.84}>
              <Text style={styles.activeChipText}>{label}: {value}</Text>
              <Feather name="x" size={13} color={colors.primary} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.84}>
            <Text style={styles.clearButtonText}>{t('servicesScreen.clearFilters')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {locationFilter ? <Text style={styles.locationResultText}>{t('servicesScreen.inLocation', { location: locationFilter })}</Text> : null}

      <View style={styles.resultsHeader}>
        {hideTopBar ? <Text style={styles.resultsTitle}>{t('servicesScreen.title')}</Text> : <View />}
        <Text style={styles.resultsCount}>{t('servicesScreen.availableNow', { count: filteredServices.length })}</Text>
      </View>

      {!!error && (
        <TouchableOpacity style={styles.statusBox} activeOpacity={0.8} onPress={retry}>
          <Text style={styles.statusTitle}>{t('servicesScreen.unavailable')}</Text>
          <Text style={styles.statusText}>{t('servicesScreen.retry')}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredServices}
        keyExtractor={keyExtractor}
        renderItem={renderService}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.listGap} />}
        ListEmptyComponent={!loading ? <Text style={styles.noResultsText}>{t('servicesScreen.empty')}</Text> : null}
        ListFooterComponent={loading || loadingMore ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{loadingMore ? t('servicesScreen.loadingMore') : t('servicesScreen.loading')}</Text>
          </View>
        ) : pagination?.hasNextPage === false && services.length ? <Text style={styles.endText}>{t('servicesScreen.endOfResults')}</Text> : null}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />

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

const ServiceRow = memo(function ServiceRow({ service, onPress }) {
  const [imageFailed, setImageFailed] = useState(false);
  const promotion = getVisiblePromotion(service.promotion);
  return (
    <TouchableOpacity
      style={styles.serviceRow}
      activeOpacity={0.88}
      onPress={() => onPress(service)}
    >
      {imageFailed ? (
        <View style={[styles.rowImage, styles.imagePlaceholder]}><Feather name="image" size={20} color={colors.muted} /></View>
      ) : (
        <Image source={{ uri: service.image }} style={styles.rowImage} resizeMode="cover" onError={() => setImageFailed(true)} />
      )}
      {promotion ? (
        <View style={styles.rowPromotionBadge}>
          <Text style={styles.rowPromotionBadgeText}>-{promotion.percent}%</Text>
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>{service.title}</Text>
          <View style={styles.ratingPill}>
            <Feather name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>{Number(service.rating || 4.8).toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.rowLocation} numberOfLines={1}>{service.generalLocation || service.location}</Text>
        {promotion ? <Text style={styles.rowPromotionTitle} numberOfLines={1}>{promotion.title}</Text> : null}
        <Text style={styles.rowDescription} numberOfLines={2}>{service.description}</Text>
        <View style={styles.rowFooter}>
          <Text style={styles.rowPrice}>{service.price}</Text>
          <Text style={styles.rowMode}>{service.bookingMode}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarCenter: {
    flex: 1,
  },
  searchBox: {
    alignItems: 'center',
    ...baseInputStyle(colors),
    borderRadius: 12,
    flexDirection: 'row',
    height: 44,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  filtersPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  filterField: {
    marginTop: 0,
  },
  input: {
    ...passwordFieldStyle(colors),
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  filterRow: {
    gap: 8,
    paddingTop: 2,
  },
  filter: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterTextActive: {
    color: colors.white,
  },
  statusBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  statusTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  statusText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  listGap: {
    height: 10,
  },
  resultsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 2,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  resultsCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 12,
  },
  serviceRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
    position: 'relative',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  rowImage: {
    borderRadius: 12,
    height: 106,
    width: 92,
  },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
  },
  rowPromotionBadge: {
    backgroundColor: '#FBBF24',
    borderColor: '#F59E0B',
    borderRadius: 999,
    borderWidth: 1,
    left: 16,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    top: 16,
  },
  rowPromotionBadgeText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '900',
  },
  rowBody: {
    flex: 1,
    justifyContent: 'space-between',
    paddingLeft: 12,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rowTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  ratingPill: {
    alignItems: 'center',
    backgroundColor: colors.warningSurface,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
  },
  rowLocation: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  rowPromotionTitle: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  rowDescription: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 6,
    opacity: 0.78,
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rowPrice: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  rowMode: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  searchControls: {
    flexDirection: 'column',
    gap: 8,
  },
  availableToggle: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  availableToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  availableToggleText: {
    color: colors.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  availableToggleTextActive: {
    color: colors.white,
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  activeChip: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activeChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  clearButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  locationResultText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  noResultsText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  endText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 16,
    textAlign: 'center',
  },
});



